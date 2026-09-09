"""Gestionnaires d'événements Socket.IO pour les salons Synk."""

import html
import secrets
import time
import urllib.parse
from typing import Any

from pydantic import BaseModel, ValidationError
from socketio.exceptions import ConnectionRefusedError

from core.logger import logger
from core.rate_limiter import check_ws_rate_limit
from core.socket import sio
from db.manager import DatabaseManager
from domains.media.extractor import media_extractor
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
from domains.room.sync import calculate_reference_position


def _extract_auth(environ: dict[str, Any], auth: Any) -> dict[str, str | None]:
    """Extrait les identifiants depuis le payload auth ou les paramètres URL."""
    params: dict[str, Any] = auth.copy() if isinstance(auth, dict) else {}
    if "QUERY_STRING" in environ:
        for key, val in urllib.parse.parse_qs(environ["QUERY_STRING"]).items():
            if val and key not in params:
                params[key] = val[0]
    return {
        "room_id": params.get("room_id") or params.get("roomId"),
        "username": params.get("username"),
        "token": params.get("token"),
        "user_id": params.get("user_id") or params.get("userId"),
    }


def _validate_payload[T: BaseModel](model_cls: type[T], data: Any) -> T | None:
    """Valide les données entrantes avec le modèle Pydantic spécifié."""
    if not isinstance(data, dict):
        return None
    try:
        return model_cls.model_validate(data)
    except (ValidationError, ValueError, TypeError):
        return None


async def _send_error(sid: str, code: str, message: str, **extra: Any) -> None:
    """Envoie un événement d'erreur normalisé au client."""
    await sio.emit(
        ServerEventType.ERROR,
        {"code": code, "message": message, **extra},
        to=sid,
    )


async def _guard[T: BaseModel](
    sid: str,
    data: Any,
    model_cls: type[T],
    action: str,
    err_code: str | None = None,
    err_msg: str | None = None,
) -> tuple[dict[str, Any], T] | None:
    """Récupère la session, valide le payload et vérifie les quotas d'actions."""
    session = await sio.get_session(sid)
    if not session:
        return None

    payload = _validate_payload(model_cls, data)
    if not payload:
        code = err_code or f"INVALID_{action}_PAYLOAD"
        msg = err_msg or f"Payload invalide pour l'action {action}"
        await _send_error(sid, code, msg)
        return None

    allowed, wait_sec = await check_ws_rate_limit(session["user_id"], action)
    if not allowed:
        if action != ClientEventType.HEARTBEAT:
            await _send_error(
                sid,
                "RATE_LIMITED",
                f"Too many fast actions ({action}). Please wait {wait_sec}s.",
                action=action,
                retry_after=wait_sec,
            )
        return None

    return session, payload


async def _update_and_broadcast_player(
    sid: str,
    session: dict[str, Any],
    action: str,
    updates: dict[str, Any],
    extra_broadcast: dict[str, Any] | None = None,
) -> None:
    """Met à jour l'état du lecteur en base et diffuse la modification au salon."""
    room_id = session["room_id"]
    with DatabaseManager() as db:
        room = await db.room_service.get_room(room_id)
        if not room:
            await _send_error(sid, "ROOM_NOT_FOUND", "Salon introuvable")
            return

        participant = Participant(
            id=session["user_id"],
            username=session["username"],
            is_host=(room.host_id == session["user_id"]),
        )
        updated_room, err = await db.room_service.update_player_safe(
            room_id, participant, **updates
        )

    if err == "LOCKED":
        await _send_error(sid, "LOCKED", "Le salon est verrouillé par l'hôte")
        return
    if err == "NOOP" or not updated_room:
        return

    payload = {
        "action": action,
        "triggered_by": session["username"],
        "player": updated_room.player.model_dump(),
        **(extra_broadcast or {}),
    }
    await sio.emit(ServerEventType.PLAYER_UPDATED, payload, room=room_id)


# ----------------------------------------------------------------------
# Cycle de vie des connexions
# ----------------------------------------------------------------------


async def _authenticate(creds: dict[str, str | None]) -> tuple[Room, Participant]:
    """Valide les identifiants et enregistre le participant en base."""
    room_id, username = creds["room_id"], creds["username"]
    if not room_id or not username:
        raise ConnectionRefusedError("Identifiants manquants")

    with DatabaseManager() as db:
        if not await db.room_service.room_exists(room_id):
            raise ConnectionRefusedError("Salon introuvable")

        is_host = (
            await db.room_service.verify_host_token(room_id, creds["token"])
            if creds["token"]
            else False
        )
        result = await db.room_service.add_participant(
            room_id, username, user_id=creds["user_id"], is_host=is_host
        )
        if not result:
            raise ConnectionRefusedError("Impossible de rejoindre le salon")
        return result


async def _send_initial_sync(sid: str, room: Room, participant: Participant) -> None:
    """Envoie l'état initial du salon au nouvel arrivant et notifie les autres."""
    now_ms = int(time.time() * 1000)
    room_dict = room.model_dump()
    if room.player.is_playing:
        ref_pos = calculate_reference_position(room.player, now_ms=now_ms)
        if (
            room.player.duration
            and room.player.duration > 0
            and ref_pos >= room.player.duration
        ):
            room_dict["player"]["is_playing"] = False
            room_dict["player"]["current_time"] = room.player.duration
        else:
            room_dict["player"]["current_time"] = ref_pos
        room_dict["player"]["last_updated_at"] = now_ms

    await sio.emit(
        ServerEventType.ROOM_SYNC,
        {
            "room": room_dict,
            "your_id": participant.id,
            "your_username": participant.username,
        },
        to=sid,
    )
    await sio.emit(
        ServerEventType.PARTICIPANT_JOINED,
        {"user": participant.model_dump()},
        room=room.room_id,
        skip_sid=sid,
    )
    logger.info(
        f"[SIO:JOIN] {participant.username} ({participant.id}) -> {room.room_id}"
    )


@sio.event
async def connect(sid: str, environ: dict[str, Any], auth: Any = None) -> None:
    """Authentifie le participant, initialise sa session et synchronise le salon."""
    creds = _extract_auth(environ, auth)
    room, participant = await _authenticate(creds)

    await sio.enter_room(sid, room.room_id)
    await sio.enter_room(sid, f"user:{participant.id}")
    await sio.save_session(
        sid,
        {
            "room_id": room.room_id,
            "user_id": participant.id,
            "username": participant.username,
            "ping_ms": 0,
        },
    )

    await _send_initial_sync(sid, room, participant)


@sio.event
async def disconnect(sid: str) -> None:
    """Traite la déconnexion, réassigne l'hôte si nécessaire et prévient le salon."""
    session = await sio.get_session(sid)
    if not session:
        return
    room_id = session.get("room_id")
    user_id = session.get("user_id")
    username = session.get("username")
    if not room_id or not user_id:
        return

    with DatabaseManager() as db:
        (
            updated_room,
            new_host_id,
            new_host_token,
        ) = await db.room_service.remove_participant(room_id, user_id)

    if updated_room and updated_room.participants:
        await sio.emit(
            ServerEventType.PARTICIPANT_LEFT,
            {
                "user_id": user_id,
                "username": username,
                "new_host_id": new_host_id,
            },
            room=room_id,
        )
        if new_host_id and new_host_token:
            await sio.emit(
                ServerEventType.HOST_PROMOTED,
                {"host_token": new_host_token},
                room=f"user:{new_host_id}",
            )
    logger.info(f"[SIO:LEAVE] {username} ({user_id}) <- {room_id}")


# ----------------------------------------------------------------------
# Gestionnaires d'événements
# ----------------------------------------------------------------------


@sio.on(ClientEventType.PLAY)
async def on_play(sid: str, data: Any) -> None:
    """Gère la reprise de lecture vidéo."""
    guard = await _guard(sid, data, PlayPayload, "PLAY")
    if not guard:
        return
    session, payload = guard

    updates: dict[str, Any] = {"is_playing": True, "current_time": payload.current_time}
    if payload.duration and payload.duration > 0:
        updates["duration"] = payload.duration

    await _update_and_broadcast_player(
        sid,
        session,
        action="PLAY",
        updates=updates,
        extra_broadcast={"current_time": payload.current_time},
    )


@sio.on(ClientEventType.PAUSE)
async def on_pause(sid: str, data: Any) -> None:
    """Gère la mise en pause de la vidéo."""
    guard = await _guard(sid, data, PausePayload, "PAUSE")
    if not guard:
        return
    session, payload = guard

    updates: dict[str, Any] = {"is_playing": False, "current_time": payload.current_time}
    if payload.duration and payload.duration > 0:
        updates["duration"] = payload.duration

    await _update_and_broadcast_player(
        sid,
        session,
        action="PAUSE",
        updates=updates,
        extra_broadcast={"current_time": payload.current_time},
    )


@sio.on(ClientEventType.SEEK)
async def on_seek(sid: str, data: Any) -> None:
    """Gère le saut temporel dans la vidéo (Seek)."""
    guard = await _guard(sid, data, SeekPayload, "SEEK")
    if not guard:
        return
    session, payload = guard

    updates: dict[str, Any] = {"current_time": payload.target_time}
    if payload.duration and payload.duration > 0:
        updates["duration"] = payload.duration

    await _update_and_broadcast_player(
        sid,
        session,
        action="SEEK",
        updates=updates,
        extra_broadcast={"target_time": payload.target_time},
    )


@sio.on(ClientEventType.CHANGE_MEDIA)
async def on_change_media(sid: str, data: Any) -> None:
    """Gère le chargement d'un nouveau média."""
    guard = await _guard(
        sid, data, ChangeMediaPayload, "CHANGE_MEDIA", err_code="INVALID_MEDIA_URL"
    )
    if not guard:
        return
    session, payload = guard

    media = media_extractor.extract(payload.url)
    if not media:
        await _send_error(
            sid, "INVALID_MEDIA_URL", "Format ou plateforme de média non supporté"
        )
        return

    media_info = {
        "media_url": media.url,
        "media_id": media.media_id,
        "provider": media.provider,
        "media_type": media.media_type.value,
    }
    await _update_and_broadcast_player(
        sid,
        session,
        action="CHANGE_MEDIA",
        updates={"is_playing": False, "current_time": 0.0, "duration": 0.0, **media_info},
        extra_broadcast={"duration": 0.0, **media_info},
    )


@sio.on(ClientEventType.CHAT_MESSAGE)
async def on_chat_message(sid: str, data: Any) -> None:
    """Gère la diffusion d'un message de chat avec échappement HTML."""
    guard = await _guard(sid, data, ChatMessagePayload, "CHAT_MESSAGE")
    if not guard:
        return
    session, payload = guard

    clean_content = html.escape(payload.content.strip())
    message_data = {
        "id": f"msg_{secrets.token_hex(4)}",
        "user_id": session["user_id"],
        "username": session["username"],
        "content": clean_content,
        "time": time.strftime("%H:%M"),
    }
    await sio.emit(
        ServerEventType.CHAT_BROADCAST, message_data, room=session["room_id"]
    )


@sio.on(ClientEventType.HEARTBEAT)
async def on_heartbeat(sid: str, data: Any) -> None:
    """Mesure la latence du client et renvoie un acquittement."""
    guard = await _guard(sid, data, HeartbeatPayload, "HEARTBEAT")
    if not guard:
        return
    session, payload = guard

    now_ms = int(time.time() * 1000)
    latency = payload.ping_ms if payload.ping_ms > 0 else max(0, now_ms - payload.client_sent_at)
    prev_ping = session.get("ping_ms", 0)
    session["ping_ms"] = latency
    await sio.save_session(sid, session)

    await sio.emit(
        ServerEventType.HEARTBEAT_ACK,
        {
            "client_sent_at": payload.client_sent_at,
            "server_received_at": now_ms,
            "ping_ms": latency,
        },
        to=sid,
    )

    if prev_ping == 0 or abs(prev_ping - latency) >= 15:
        await sio.emit(
            ServerEventType.PING_UPDATED,
            {"user_id": session["user_id"], "ping_ms": latency},
            room=session["room_id"],
            skip_sid=sid,
        )


@sio.on(ClientEventType.UPDATE_SETTINGS)
async def on_update_settings(sid: str, data: Any) -> None:
    """Gère la modification du verrouillage du salon par l'hôte."""
    guard = await _guard(sid, data, UpdateSettingsPayload, "UPDATE_SETTINGS")
    if not guard:
        return
    session, payload = guard

    room_id = session["room_id"]
    with DatabaseManager() as db:
        room = await db.room_service.get_room(room_id)
        if not room:
            await _send_error(sid, "ROOM_NOT_FOUND", "Salon introuvable")
            return

        participant = Participant(
            id=session["user_id"],
            username=session["username"],
            is_host=(room.host_id == session["user_id"]),
        )
        updated_room, err = await db.room_service.update_settings_safe(
            room_id, participant, payload.is_locked
        )

    if err == "FORBIDDEN":
        await _send_error(sid, "FORBIDDEN", "Seul l'hôte peut modifier les paramètres")
        return
    if err == "NOOP" or not updated_room:
        return

    await sio.emit(
        ServerEventType.SETTINGS_UPDATED,
        {"settings": updated_room.settings.model_dump()},
        room=room_id,
    )
