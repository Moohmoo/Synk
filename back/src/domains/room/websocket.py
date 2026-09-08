import asyncio
import html
import json
import math
import secrets
import time
from collections import defaultdict
from typing import Any

from fastapi import WebSocket, WebSocketDisconnect, status
from pydantic import ValidationError
from redis.asyncio import Redis

from core.config import settings
from core.logger import logger
from core.rate_limiter import WebSocketRateLimiter
from domains.media.extractor import media_extractor
from domains.room.crud import RoomService
from domains.room.schemas.room import Participant, Room
from domains.room.schemas.websocket import (
    ChangeMediaPayload,
    ChatMessagePayload,
    ClientEventType,
    HeartbeatPayload,
    PausePayload,
    PlayPayload,
    SeekPayload,
    ServerEventType,
    UpdateSettingsPayload,
)
from domains.room.sync import SyncService


class RoomWebSocketManager:
    """
    Gestionnaire temps réel WebSocket et relais Redis Pub/Sub pour les salons Synk.
    Chaque méthode a une responsabilité unique et un périmètre restreint (< 20 lignes).
    """

    def __init__(self):
        # Sockets locales de ce worker : room_id -> { user_id: WebSocket }
        self._local_rooms: dict[str, dict[str, WebSocket]] = defaultdict(dict)
        # Tâches d'écoute Pub/Sub par salon pour ce worker : room_id -> asyncio.Task
        self._pubsub_tasks: dict[str, asyncio.Task] = {}
        self._lock = asyncio.Lock()
        # Limiteur de débit et protection anti-flood en mémoire
        self._rate_limiter = WebSocketRateLimiter(
            global_rate=settings.WS_RATE_LIMIT_PER_SEC,
            global_capacity=settings.WS_RATE_LIMIT_BURST,
        )

    @staticmethod
    def _channel_name(room_id: str) -> str:
        return f"channel:room:{room_id}"

    # ------------------------------------------------------------------
    # 1. Transport & Relais Redis Pub/Sub
    # ------------------------------------------------------------------

    async def _start_pubsub_listener_if_needed(
        self, room_id: str, redis: Redis
    ) -> None:
        """Démarre une tâche d'écoute Pub/Sub sur le canal Redis du salon."""
        async with self._lock:
            if room_id in self._pubsub_tasks:
                return
            task = asyncio.create_task(self._listen_to_channel(room_id, redis))
            self._pubsub_tasks[room_id] = task
            logger.info(f"[PUBSUB:START] Écoute démarrée pour le salon {room_id}")

    @staticmethod
    def _parse_pubsub_message(
        raw_data: Any,
    ) -> tuple[str, dict, int, str | None, str | None] | None:
        """Décode un message JSON provenant de Redis Pub/Sub."""
        try:
            d = json.loads(raw_data)
            return (
                d["event"],
                d.get("payload", {}),
                d.get("timestamp", int(time.time() * 1000)),
                d.get("exclude_user_id"),
                d.get("target_user_id"),
            )
        except (json.JSONDecodeError, TypeError, KeyError):
            return None

    async def _listen_to_channel(self, room_id: str, redis: Redis) -> None:
        """Boucle de réception Pub/Sub pour diffusion aux sockets locales."""
        pubsub = redis.pubsub()
        await pubsub.subscribe(self._channel_name(room_id))
        try:
            async for msg in pubsub.listen():
                if msg["type"] != "message":
                    continue
                parsed = self._parse_pubsub_message(msg["data"])
                if parsed:
                    event, payload, ts, exclude_id, target_user_id = parsed
                    if target_user_id:
                        await self.send_to_user_locally(
                            room_id, target_user_id, event, payload, ts
                        )
                    else:
                        await self._broadcast_locally(
                            room_id, event, payload, ts, exclude_id
                        )
        except asyncio.CancelledError:
            logger.info(f"[PUBSUB:CANCEL] Écoute arrêtée pour le salon {room_id}")
        finally:
            await pubsub.unsubscribe(self._channel_name(room_id))
            await pubsub.aclose()

    async def _stop_pubsub_listener_if_empty(self, room_id: str) -> None:
        """Arrête la tâche d'écoute si plus aucun utilisateur local n'est connecté."""
        async with self._lock:
            if room_id not in self._local_rooms or not self._local_rooms[room_id]:
                task = self._pubsub_tasks.pop(room_id, None)
                if task and not task.done():
                    task.cancel()
                logger.info(f"[PUBSUB:STOP] Écoute terminée pour le salon {room_id}")

    async def _broadcast_locally(
        self,
        room_id: str,
        event_name: str,
        payload: dict[str, Any],
        timestamp: int,
        exclude_user_id: str | None = None,
    ) -> None:
        """Diffuse un message aux websockets locales de ce worker."""
        msg = json.dumps(
            {"event": event_name, "payload": payload, "timestamp": timestamp}
        )
        async with self._lock:
            sockets = [
                ws
                for uid, ws in self._local_rooms.get(room_id, {}).items()
                if uid != exclude_user_id
            ]
        for ws in sockets:
            await self._safe_send(ws, msg)

    async def broadcast_distributed(
        self,
        redis: Redis,
        room_id: str,
        event_name: str,
        payload: dict[str, Any],
        timestamp: int,
        exclude_user_id: str | None = None,
    ) -> None:
        """Publie un événement sur Redis Pub/Sub pour tous les workers."""
        msg = json.dumps(
            {
                "event": event_name,
                "payload": payload,
                "timestamp": timestamp,
                "exclude_user_id": exclude_user_id,
            }
        )
        await redis.publish(self._channel_name(room_id), msg)

    async def send_to_user_distributed(
        self,
        redis: Redis,
        room_id: str,
        target_user_id: str,
        event_name: str,
        payload: dict[str, Any],
        timestamp: int,
    ) -> None:
        """Publie un événement privé ciblé sur Redis Pub/Sub pour un utilisateur spécifique."""
        msg = json.dumps(
            {
                "event": event_name,
                "payload": payload,
                "timestamp": timestamp,
                "target_user_id": target_user_id,
            }
        )
        await redis.publish(self._channel_name(room_id), msg)

    async def send_to_user_locally(
        self,
        room_id: str,
        user_id: str,
        event_name: str,
        payload: dict[str, Any],
        timestamp: int,
    ) -> None:
        """Envoie un événement direct à un utilisateur connecté sur ce worker."""
        async with self._lock:
            ws = self._local_rooms.get(room_id, {}).get(user_id)
        if ws:
            msg = json.dumps(
                {"event": event_name, "payload": payload, "timestamp": timestamp}
            )
            await self._safe_send(ws, msg)

    @staticmethod
    async def _safe_send(websocket: WebSocket, text: str) -> None:
        """Envoie sécurisé d'un texte sans crasher sur socket fermée."""
        try:
            await websocket.send_text(text)
        except (WebSocketDisconnect, RuntimeError):
            pass

    async def _send_error(
        self, room_id: str, user_id: str, code: str, message: str
    ) -> None:
        """Envoie une erreur applicative normalisée au client."""
        now_ms = int(time.time() * 1000)
        await self.send_to_user_locally(
            room_id,
            user_id,
            ServerEventType.ERROR,
            {"code": code, "message": message},
            now_ms,
        )

    # ------------------------------------------------------------------
    # 2. Cycle de vie de la connexion (Orchestration & Échelons)
    # ------------------------------------------------------------------

    @staticmethod
    def _resolve_crud(crud: RoomService | None) -> RoomService:
        """Résout le service CRUD depuis DatabaseManager si non fourni."""
        if crud is not None:
            return crud
        from db.manager import DatabaseManager

        with DatabaseManager() as db:
            return db.room_service

    async def _authenticate_participant(
        self,
        websocket: WebSocket,
        crud: RoomService,
        room_id: str,
        username: str,
        token: str | None,
        user_id: str | None,
    ) -> tuple[Room, Participant] | None:
        """Valide l'accès et enregistre le participant en base."""
        if not await crud.room_exists(room_id):
            await websocket.close(
                code=status.WS_1008_POLICY_VIOLATION, reason="Salon introuvable"
            )
            return None

        is_host = await crud.verify_host_token(room_id, token) if token else False
        result = await crud.add_participant(
            room_id, username, user_id=user_id, is_host=is_host
        )
        if not result:
            await websocket.close(
                code=status.WS_1008_POLICY_VIOLATION, reason="Impossible de rejoindre"
            )
            return None

        return result

    async def _register_socket(
        self, room_id: str, participant: Participant, websocket: WebSocket, redis: Redis
    ) -> None:
        """Accepte la connexion WebSocket et l'enregistre localement."""
        await websocket.accept()
        async with self._lock:
            self._local_rooms[room_id][participant.id] = websocket
        await self._start_pubsub_listener_if_needed(room_id, redis)

    async def _notify_initial_join(
        self, room_id: str, participant: Participant, room: Room, redis: Redis
    ) -> None:
        """Envoie l'état complet initial à l'utilisateur et informe le salon de son arrivée."""
        now_ms = int(time.time() * 1000)
        room_dict = room.model_dump()
        if room.player.is_playing:
            ref_pos = SyncService.calculate_reference_position(room.player, now_ms=now_ms)
            room_dict["player"]["current_time"] = ref_pos
            room_dict["player"]["last_updated_at"] = now_ms

        await self.send_to_user_locally(
            room_id,
            participant.id,
            ServerEventType.ROOM_SYNC,
            {
                "room": room_dict,
                "your_id": participant.id,
                "your_username": participant.username,
            },
            now_ms,
        )
        await self.broadcast_distributed(
            redis,
            room_id,
            ServerEventType.PARTICIPANT_JOINED,
            {"user": participant.model_dump()},
            now_ms,
            exclude_user_id=participant.id,
        )

    async def _message_loop(
        self,
        websocket: WebSocket,
        room_id: str,
        participant: Participant,
        crud: RoomService,
    ) -> None:
        """Boucle de réception des trames texte du client avec protection de taille."""
        while True:
            text_data = await websocket.receive_text()
            if len(text_data) > settings.WS_MAX_PAYLOAD_SIZE:
                await self._send_error(
                    room_id,
                    participant.id,
                    "PAYLOAD_TOO_LARGE",
                    "Taille de message trop volumineuse",
                )
                continue
            try:
                raw_event = json.loads(text_data)
            except json.JSONDecodeError:
                await self._send_error(
                    room_id, participant.id, "INVALID_JSON", "Format JSON invalide"
                )
                continue
            await self._process_event(raw_event, room_id, participant, crud)

    async def _cleanup_disconnect(
        self,
        room_id: str,
        participant: Participant,
        crud: RoomService,
        websocket: WebSocket,
    ) -> None:
        """Nettoie la socket locale, purge les buckets de rate limiting, met à jour Redis et notifie le départ."""
        self._rate_limiter.cleanup(f"{room_id}:{participant.id}")

        async with self._lock:
            current_ws = self._local_rooms.get(room_id, {}).get(participant.id)
            if current_ws is not None and current_ws != websocket:
                logger.info(
                    f"[WS:RECONNECTED] Socket obsolète fermée pour {participant.username} ({participant.id}), nouvelle connexion préservée"
                )
                return

            if room_id in self._local_rooms:
                self._local_rooms[room_id].pop(participant.id, None)
                if not self._local_rooms[room_id]:
                    del self._local_rooms[room_id]

        await self._stop_pubsub_listener_if_empty(room_id)
        updated_room, new_host_id, new_host_token = await crud.remove_participant(
            room_id, participant.id
        )

        if updated_room and updated_room.participants:
            now_ms = int(time.time() * 1000)
            await self.broadcast_distributed(
                crud.redis,
                room_id,
                ServerEventType.PARTICIPANT_LEFT,
                {
                    "user_id": participant.id,
                    "username": participant.username,
                    "new_host_id": new_host_id,
                },
                now_ms,
            )

            # Transmettre le nouveau token d'hôte exclusivement au nouveau chef de salon
            if new_host_id and new_host_token:
                await self.send_to_user_distributed(
                    crud.redis,
                    room_id,
                    new_host_id,
                    ServerEventType.HOST_PROMOTED,
                    {"host_token": new_host_token},
                    now_ms,
                )

    async def handle_connection(
        self,
        websocket: WebSocket,
        room_id: str,
        username: str,
        token: str | None = None,
        user_id: str | None = None,
        crud: RoomService | None = None,
    ) -> None:
        """
        Point d'entrée principal : orchestre la session en 5 étapes claires.
        """
        crud = self._resolve_crud(crud)
        auth = await self._authenticate_participant(
            websocket, crud, room_id, username, token, user_id
        )
        if not auth:
            return

        room, participant = auth
        await self._register_socket(room_id, participant, websocket, crud.redis)
        await self._notify_initial_join(room_id, participant, room, crud.redis)

        try:
            await self._message_loop(websocket, room_id, participant, crud)
        except WebSocketDisconnect:
            logger.info(f"[WS:DISCONNECT] {participant.username} ({participant.id})")
        except Exception as e:  # noqa: BLE001
            logger.warning(f"[WS:EXCEPTION] {participant.id} : {e}")
        finally:
            await self._cleanup_disconnect(room_id, participant, crud, websocket)

    # ------------------------------------------------------------------
    # 3. Dispatching et Handlers Métier
    # ------------------------------------------------------------------

    async def _process_event(
        self,
        raw_event: dict[str, Any],
        room_id: str,
        participant: Participant,
        crud: RoomService,
    ) -> None:
        """Aiguille l'événement vers son gestionnaire dédié après contrôle anti-spam."""
        event_name = raw_event.get("event")
        payload = raw_event.get("payload", {})
        now_ms = int(time.time() * 1000)

        # Contrôle anti-flood global & anti-spam par action
        conn_key = f"{room_id}:{participant.id}"
        allowed, reason, wait_seconds = self._rate_limiter.check(conn_key, event_name)
        if not allowed:
            if event_name == ClientEventType.HEARTBEAT:
                return
            await self._send_error(
                room_id,
                participant.id,
                "RATE_LIMITED",
                f"Trop d'actions rapides ({reason}). Veuillez patienter {max(1, math.ceil(wait_seconds))}s.",
            )
            return

        match event_name:
            case ClientEventType.PLAY:
                await self._on_play(payload, room_id, participant, crud, now_ms)
            case ClientEventType.PAUSE:
                await self._on_pause(payload, room_id, participant, crud, now_ms)
            case ClientEventType.SEEK:
                await self._on_seek(payload, room_id, participant, crud, now_ms)
            case ClientEventType.CHANGE_MEDIA:
                await self._on_change_media(payload, room_id, participant, crud, now_ms)
            case ClientEventType.CHAT_MESSAGE:
                await self._on_chat(payload, room_id, participant, crud, now_ms)
            case ClientEventType.HEARTBEAT:
                await self._on_heartbeat(payload, room_id, participant, crud, now_ms)
            case ClientEventType.UPDATE_SETTINGS:
                await self._on_update_settings(
                    payload, room_id, participant, crud, now_ms
                )
            case _:
                await self._send_error(
                    room_id,
                    participant.id,
                    "UNKNOWN_EVENT",
                    f"Événement inconnu : {event_name}",
                )

    async def _validate(
        self,
        model_cls: type,
        payload: dict[str, Any],
        room_id: str,
        user_id: str,
        error_msg: str,
        error_code: str = "INVALID_PAYLOAD",
    ) -> Any | None:
        """Valide un payload Pydantic et envoie une erreur au client en cas d'échec."""
        try:
            return model_cls.model_validate(payload)
        except (ValidationError, ValueError):
            await self._send_error(room_id, user_id, error_code, error_msg)
            return None

    async def _apply_player_update(
        self,
        room_id: str,
        participant: Participant,
        crud: RoomService,
        action: str,
        updates: dict[str, Any],
        extra_broadcast: dict[str, Any],
        now_ms: int,
    ) -> None:
        """Applique une modification du lecteur multimédia et diffuse le résultat."""
        room, err = await crud.update_player_safe(room_id, participant, **updates)
        if err == "LOCKED":
            await self._send_error(
                room_id, participant.id, "LOCKED", "Le salon est verrouillé par l'hôte"
            )
            return
        if err == "NOOP":
            return
        if room:
            player_dict = room.player.model_dump()
            data = {
                "action": action,
                "triggered_by": participant.username,
                "player": player_dict,
                **extra_broadcast,
            }
            await self.broadcast_distributed(
                crud.redis, room_id, ServerEventType.PLAYER_UPDATED, data, now_ms
            )

    async def _on_play(
        self,
        payload: dict,
        room_id: str,
        participant: Participant,
        crud: RoomService,
        now_ms: int,
    ) -> None:
        """Gère l'action Play."""
        data = await self._validate(
            PlayPayload,
            payload,
            room_id,
            participant.id,
            "Payload de lecture invalide",
            error_code="INVALID_PLAY_PAYLOAD",
        )
        if not data:
            return
        await self._apply_player_update(
            room_id,
            participant,
            crud,
            "PLAY",
            {"is_playing": True, "current_time": data.current_time},
            {"current_time": data.current_time},
            now_ms,
        )

    async def _on_pause(
        self,
        payload: dict,
        room_id: str,
        participant: Participant,
        crud: RoomService,
        now_ms: int,
    ) -> None:
        """Gère l'action Pause."""
        data = await self._validate(
            PausePayload,
            payload,
            room_id,
            participant.id,
            "Payload de pause invalide",
            error_code="INVALID_PAUSE_PAYLOAD",
        )
        if not data:
            return
        await self._apply_player_update(
            room_id,
            participant,
            crud,
            "PAUSE",
            {"is_playing": False, "current_time": data.current_time},
            {"current_time": data.current_time},
            now_ms,
        )

    async def _on_seek(
        self,
        payload: dict,
        room_id: str,
        participant: Participant,
        crud: RoomService,
        now_ms: int,
    ) -> None:
        """Gère le saut temporel (Seek)."""
        data = await self._validate(
            SeekPayload,
            payload,
            room_id,
            participant.id,
            "Payload de saut temporel invalide",
            error_code="INVALID_SEEK_PAYLOAD",
        )
        if not data:
            return
        await self._apply_player_update(
            room_id,
            participant,
            crud,
            "SEEK",
            {"current_time": data.target_time},
            {"target_time": data.target_time},
            now_ms,
        )

    async def _on_change_media(
        self,
        payload: dict,
        room_id: str,
        participant: Participant,
        crud: RoomService,
        now_ms: int,
    ) -> None:
        """Gère le changement de source multimédia via le MediaExtractor."""
        data = await self._validate(
            ChangeMediaPayload,
            payload,
            room_id,
            participant.id,
            "URL de média invalide",
            error_code="INVALID_MEDIA_URL",
        )
        if not data:
            return

        media = media_extractor.extract(data.url)
        if not media:
            await self._send_error(
                room_id,
                participant.id,
                "INVALID_MEDIA_URL",
                "Format ou plateforme de média non supporté",
            )
            return

        await self._apply_player_update(
            room_id,
            participant,
            crud,
            "CHANGE_MEDIA",
            {
                "is_playing": False,
                "current_time": 0.0,
                "media_url": media.url,
                "media_id": media.media_id,
                "provider": media.provider,
                "media_type": media.media_type.value,
            },
            {
                "media_url": media.url,
                "media_id": media.media_id,
                "provider": media.provider,
                "media_type": media.media_type.value,
            },
            now_ms,
        )

    async def _on_chat(
        self,
        payload: dict,
        room_id: str,
        participant: Participant,
        crud: RoomService,
        now_ms: int,
    ) -> None:
        """Gère la diffusion d'un message dans le chat."""
        data = await self._validate(
            ChatMessagePayload,
            payload,
            room_id,
            participant.id,
            "Message de chat invalide",
            error_code="INVALID_CHAT_PAYLOAD",
        )
        if not data:
            return
        clean_content = html.escape(data.content.strip())
        await self.broadcast_distributed(
            crud.redis,
            room_id,
            ServerEventType.CHAT_BROADCAST,
            {
                "id": f"msg_{secrets.token_hex(4)}",
                "user_id": participant.id,
                "username": participant.username,
                "content": clean_content,
                "time": time.strftime("%H:%M"),
            },
            now_ms,
        )

    async def _on_heartbeat(
        self,
        payload: dict,
        room_id: str,
        participant: Participant,
        crud: RoomService,
        now_ms: int,
    ) -> None:
        """Gère le Heartbeat et mesure la latence ping."""
        data = await self._validate(
            HeartbeatPayload,
            payload,
            room_id,
            participant.id,
            "Heartbeat invalide",
            error_code="INVALID_HEARTBEAT",
        )
        if not data:
            return
        latency = max(0, now_ms - data.client_sent_at)
        prev_ping = participant.ping_ms
        participant.ping_ms = latency
        await self.send_to_user_locally(
            room_id,
            participant.id,
            ServerEventType.HEARTBEAT_ACK,
            {
                "client_sent_at": data.client_sent_at,
                "server_received_at": now_ms,
                "ping_ms": latency,
            },
            now_ms,
        )
        # N'envoyer PING_UPDATED que si premier ping ou variation significative (> 15ms)
        if prev_ping == 0 or abs(prev_ping - latency) >= 15:
            await self.broadcast_distributed(
                crud.redis,
                room_id,
                "PING_UPDATED",
                {"user_id": participant.id, "ping_ms": latency},
                now_ms,
                exclude_user_id=participant.id,
            )

    async def _on_update_settings(
        self,
        payload: dict,
        room_id: str,
        participant: Participant,
        crud: RoomService,
        now_ms: int,
    ) -> None:
        """Gère la modification des permissions par l'hôte."""
        data = await self._validate(
            UpdateSettingsPayload,
            payload,
            room_id,
            participant.id,
            "Paramètres invalides",
            error_code="INVALID_SETTINGS",
        )
        if not data:
            return
        room, err = await crud.update_settings_safe(
            room_id, participant, data.is_locked
        )
        if err == "FORBIDDEN":
            await self._send_error(
                room_id,
                participant.id,
                "FORBIDDEN",
                "Seul l'hôte peut modifier les paramètres",
            )
            return
        if err == "NOOP":
            return
        if room:
            await self.broadcast_distributed(
                crud.redis,
                room_id,
                ServerEventType.SETTINGS_UPDATED,
                {"settings": room.settings.model_dump()},
                now_ms,
            )


# Instance partagée pour la gestion des sockets en mémoire du worker
room_ws = RoomWebSocketManager()
