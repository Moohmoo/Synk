import secrets
import time

from pydantic import ValidationError
from redis.asyncio import Redis

from core.config import settings
from core.logger import logger
from domains.room.schemas.room import (
    Participant,
    PlayerState,
    Room,
    RoomSettings,
)


class RoomService:
    """
    Couche d'accès aux données Redis pour le salon (Service CRUD / Repository).
    Gère la persistance atomique de l'agrégat Room via Redis Strings (JSON) et TTL.
    """

    def __init__(self, redis: Redis) -> None:
        self.redis = redis

    # ------------------------------------------------------------------
    # Clés Redis canoniques
    # ------------------------------------------------------------------

    @staticmethod
    def _room_key(room_id: str) -> str:
        return f"room:{room_id}"

    @staticmethod
    def _host_token_key(room_id: str) -> str:
        return f"room:{room_id}:host_token"

    @staticmethod
    def _generate_room_code() -> str:
        return secrets.token_urlsafe(6)

    @staticmethod
    def _generate_user_id() -> str:
        return f"usr_{secrets.token_hex(4)}"

    @staticmethod
    def _generate_host_token() -> str:
        return f"tok_sec_{secrets.token_urlsafe(16)}"

    # ------------------------------------------------------------------
    # Cycle de Vie du Salon (Création, Lecture, Sauvegarde, Suppression)
    # ------------------------------------------------------------------

    async def create_room(self, username: str) -> tuple[Room, str]:
        """Crée un nouveau salon atomiquement dans Redis avec son hôte."""
        room_id = self._generate_room_code()
        user_id = self._generate_user_id()
        host_token = self._generate_host_token()
        now_ms = int(time.time() * 1000)

        clean_username = username.strip()

        room = Room(
            room_id=room_id,
            created_at=now_ms,
            host_id=user_id,
            settings=RoomSettings(is_locked=False),
            player=PlayerState(),
            participants=[
                Participant(
                    id=user_id,
                    username=clean_username,
                    is_host=True,
                    joined_at=now_ms,
                    ping_ms=0,
                )
            ],
        )

        pipe = self.redis.pipeline()
        pipe.set(self._room_key(room_id), room.model_dump_json())
        pipe.expire(self._room_key(room_id), settings.ROOM_TTL_SECONDS)
        pipe.set(self._host_token_key(room_id), host_token)
        pipe.expire(self._host_token_key(room_id), settings.ROOM_TTL_SECONDS)
        await pipe.execute()

        logger.info(
            f"[ROOM:CREATE] Salon {room_id} créé par {username} ({user_id}) | TTL={settings.ROOM_TTL_SECONDS}s"
        )
        return room, host_token

    async def get_room(self, room_id: str) -> Room | None:
        """Récupère et désérialise un salon depuis Redis."""
        raw_data = await self.redis.get(self._room_key(room_id))
        if not raw_data:
            return None

        try:
            return Room.model_validate_json(raw_data)
        except (ValidationError, ValueError) as e:
            logger.error(f"[ROOM] Échec de désérialisation du salon {room_id} : {e}")
            return None

    async def save_room(self, room: Room, ttl: int | None = None) -> None:
        """Persiste l'état d'un salon dans Redis et renouvelle le TTL de façon atomique."""
        key = self._room_key(room.room_id)
        current_ttl = ttl or settings.ROOM_TTL_SECONDS

        pipe = self.redis.pipeline()
        pipe.set(key, room.model_dump_json())
        pipe.expire(key, current_ttl)
        pipe.expire(self._host_token_key(room.room_id), current_ttl)
        await pipe.execute()

    async def room_exists(self, room_id: str) -> bool:
        """Vérifie si le salon existe actuellement dans Redis."""
        return await self.redis.exists(self._room_key(room_id)) > 0

    async def verify_host_token(self, room_id: str, token: str) -> bool:
        """Vérifie si le token d'administration de l'hôte est valide (temps constant)."""
        stored_token = await self.redis.get(self._host_token_key(room_id))
        if not stored_token:
            return False
        return secrets.compare_digest(stored_token, token)

    async def refresh_ttl(self, room_id: str, ttl: int | None = None) -> None:
        """Renouvelle la durée de vie du salon dans Redis."""
        target_ttl = ttl or settings.ROOM_TTL_SECONDS
        pipe = self.redis.pipeline()
        pipe.expire(self._room_key(room_id), target_ttl)
        pipe.expire(self._host_token_key(room_id), target_ttl)
        await pipe.execute()

    async def delete_room(self, room_id: str) -> bool:
        """Supprime immédiatement un salon de Redis."""
        pipe = self.redis.pipeline()
        pipe.delete(self._room_key(room_id))
        pipe.delete(self._host_token_key(room_id))
        results = await pipe.execute()
        return any(count > 0 for count in results)

    # ------------------------------------------------------------------
    # Gestion des Participants & Lecture (Transactions Directes)
    # ------------------------------------------------------------------

    async def add_participant(
        self,
        room_id: str,
        username: str,
        user_id: str | None = None,
        is_host: bool = False,
    ) -> tuple[Room, Participant] | None:
        """Ajoute ou met à jour un participant dans le salon (les participants sont identifiés par leur ID unique)."""
        room = await self.get_room(room_id)
        if not room:
            return None

        uid = user_id or f"usr_{secrets.token_hex(4)}"

        existing_index = next(
            (i for i, p in enumerate(room.participants) if p.id == uid), None
        )

        if existing_index is not None:
            # Reconnexion de la même session (F5) : conserve ses données existantes
            existing_p = room.participants[existing_index]
            participant = Participant(
                id=uid,
                username=existing_p.username,
                is_host=existing_p.is_host or is_host,
                joined_at=existing_p.joined_at,
                ping_ms=existing_p.ping_ms,
            )
            room.participants[existing_index] = participant
        else:
            # Nouvel arrivant : accepte le pseudo tel quel sans suffixage (Figma/Docs style)
            participant = Participant(
                id=uid,
                username=username,
                is_host=is_host,
                joined_at=int(time.time() * 1000),
                ping_ms=0,
            )
            room.participants.append(participant)

        await self.save_room(room, ttl=settings.ROOM_TTL_SECONDS)

        logger.info(
            f"[ROOM:JOIN] {participant.username} ({uid}) a rejoint le salon {room_id}"
        )
        return room, participant

    async def remove_participant(
        self, room_id: str, user_id: str
    ) -> tuple[Room | None, str | None, str | None]:
        """
        Retire un participant du salon.
        - Si vide : applique le TTL d'auto-nettoyage (10 min).
        - Si l'hôte part : promeut le plus ancien participant restant et révoque/régénère le token hôte dans Redis.
        """
        room = await self.get_room(room_id)
        if not room:
            return None, None, None

        departing_user = next((p for p in room.participants if p.id == user_id), None)
        room.participants = [p for p in room.participants if p.id != user_id]

        new_host_id: str | None = None
        new_host_token: str | None = None

        if not room.participants:
            # Si le salon devient complètement vide, figer la position et mettre en pause le lecteur
            if room.player.is_playing:
                now_ms = int(time.time() * 1000)
                elapsed = max(0.0, (now_ms - room.player.last_updated_at) / 1000.0)
                frozen_time = round(room.player.current_time + elapsed, 2)
                if room.player.duration > 0:
                    frozen_time = min(frozen_time, room.player.duration)
                room.player.current_time = frozen_time
                room.player.is_playing = False
                room.player.last_updated_at = now_ms

            await self.save_room(room, ttl=settings.ROOM_EMPTY_TTL_SECONDS)
            logger.info(
                f"[ROOM:EMPTY] Salon {room_id} est vide | Lecteur mis en pause | Auto-nettoyage dans {settings.ROOM_EMPTY_TTL_SECONDS}s"
            )
            return room, None, None

        if departing_user and departing_user.is_host:
            room.participants[0].is_host = True
            room.host_id = room.participants[0].id
            new_host_id = room.host_id
            new_host_token = self._generate_host_token()

            pipe = self.redis.pipeline()
            pipe.set(self._host_token_key(room_id), new_host_token)
            pipe.expire(self._host_token_key(room_id), settings.ROOM_TTL_SECONDS)
            await pipe.execute()

            logger.info(
                f"[ROOM:HOST_TRANSFER] Nouvel hôte pour {room_id} : {room.participants[0].username} ({new_host_id}) | Nouveau token généré"
            )

        await self.save_room(room, ttl=settings.ROOM_TTL_SECONDS)
        return room, new_host_id, new_host_token

    async def update_player(
        self,
        room_id: str,
        is_playing: bool | None = None,
        current_time: float | None = None,
        duration: float | None = None,
        media_url: str | None = None,
        media_id: str | None = None,
        provider: str | None = None,
        media_type: str | None = None,
    ) -> Room | None:
        """Met à jour l'état du lecteur multimédia et horodate la modification."""
        room = await self.get_room(room_id)
        if not room:
            return None

        now_ms = int(time.time() * 1000)

        if is_playing is not None:
            room.player.is_playing = is_playing
        if current_time is not None:
            room.player.current_time = current_time
        if duration is not None:
            room.player.duration = duration
        if media_url is not None:
            room.player.media_url = media_url
        if media_id is not None:
            room.player.media_id = media_id
        if provider is not None:
            room.player.provider = provider
        if media_type is not None:
            room.player.media_type = media_type

        room.player.last_updated_at = now_ms

        await self.save_room(room, ttl=settings.ROOM_TTL_SECONDS)
        return room

    async def update_player_safe(
        self,
        room_id: str,
        participant: Participant,
        is_playing: bool | None = None,
        current_time: float | None = None,
        duration: float | None = None,
        media_url: str | None = None,
        media_id: str | None = None,
        provider: str | None = None,
        media_type: str | None = None,
    ) -> tuple[Room | None, str | None]:
        """
        Effectue la vérification des permissions ET la mise à jour du lecteur
        en un SEUL aller-retour Redis (optimisation réseau et atomicité).
        """
        room = await self.get_room(room_id)
        if not room:
            return None, "NOT_FOUND"

        # Vérification du verrouillage
        if room.settings.is_locked and not participant.is_host:
            return None, "LOCKED"

        # Garde d'idempotence sur l'état de lecture :
        # Évite les écritures Redis superflues et les tempêtes de diffusion
        # si l'action ne modifie pas l'état réel de lecture.
        if (
            is_playing is not None
            and is_playing == room.player.is_playing
            and media_url is None
            and media_id is None
        ):
            return room, "NOOP"

        # Garde d'idempotence sur le saut temporel (Seek) :
        # Évite d'écrire et diffuser si la vidéo est déjà en pause au timestamp demandé (ex: rembobinage multiple à 0s)
        if (
            is_playing is None
            and media_url is None
            and media_id is None
            and current_time is not None
            and not room.player.is_playing
            and abs(room.player.current_time - current_time) < 0.01
        ):
            return room, "NOOP"

        now_ms = int(time.time() * 1000)

        if is_playing is not None:
            room.player.is_playing = is_playing
        if current_time is not None:
            room.player.current_time = current_time
        if duration is not None:
            room.player.duration = duration
        if media_url is not None:
            room.player.media_url = media_url
        if media_id is not None:
            room.player.media_id = media_id
        if provider is not None:
            room.player.provider = provider
        if media_type is not None:
            room.player.media_type = media_type

        room.player.last_updated_at = now_ms

        await self.save_room(room, ttl=settings.ROOM_TTL_SECONDS)
        return room, None

    async def update_settings_safe(
        self,
        room_id: str,
        participant: Participant,
        is_locked: bool,
    ) -> tuple[Room | None, str | None]:
        """Met à jour les paramètres du salon en vérifiant les droits d'hôte en une seule passe."""
        if not participant.is_host:
            return None, "FORBIDDEN"

        room = await self.get_room(room_id)
        if not room:
            return None, "NOT_FOUND"

        # Garde d'idempotence : évite réécritures Redis et diffusions si l'état est déjà celui requis
        if room.settings.is_locked == is_locked:
            return room, "NOOP"

        room.settings.is_locked = is_locked
        await self.save_room(room, ttl=settings.ROOM_TTL_SECONDS)
        return room, None

