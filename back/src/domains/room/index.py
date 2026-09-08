"""Point d'entrée et logique métier du domaine Room."""

from core.exceptions import (
    InvalidHostTokenError,
    RoomNotFoundError,
)
from db.manager import DatabaseManager
from domains.room.schemas.room import Room

__all__ = [
    "InvalidHostTokenError",
    "RoomNotFoundError",
    "check_room",
    "create_room",
    "delete_room",
]


async def create_room(username: str) -> tuple[Room, str]:
    """
    Crée un salon, initialise l'hôte et persiste l'état.
    Retourne l'état initial du salon et le token secret d'administration.
    """
    with DatabaseManager() as db:
        return await db.room_service.create_room(username)


async def check_room(room_id: str) -> tuple[bool, int]:
    """
    Vérifie l'existence d'un salon et retourne le nombre de participants.
    Retourne (exists, participant_count).
    """
    with DatabaseManager() as db:
        room = await db.room_service.get_room(room_id)
        if not room:
            return False, 0
        return True, len(room.participants)


async def delete_room(room_id: str, host_token: str) -> None:
    """
    Supprime un salon en validant les droits d'hôte.
    Lève RoomNotFoundError si le salon n'existe pas,
    ou InvalidHostTokenError si le token d'hôte est invalide.
    """
    with DatabaseManager() as db:
        if not await db.room_service.room_exists(room_id):
            raise RoomNotFoundError(room_id)

        if not await db.room_service.verify_host_token(room_id, host_token):
            raise InvalidHostTokenError()

        await db.room_service.delete_room(room_id)
