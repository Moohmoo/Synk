from enum import StrEnum
from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class ClientEventType(StrEnum):
    """Types d'événements envoyés du client vers le serveur (Actions)."""

    PLAY = "PLAY"
    PAUSE = "PAUSE"
    SEEK = "SEEK"
    CHANGE_MEDIA = "CHANGE_MEDIA"
    CHAT_MESSAGE = "CHAT_MESSAGE"
    HEARTBEAT = "HEARTBEAT"
    UPDATE_SETTINGS = "UPDATE_SETTINGS"


class ServerEventType(StrEnum):
    """Types d'événements diffusés du serveur vers le client (Diffusions)."""

    ROOM_SYNC = "ROOM_SYNC"
    PLAYER_UPDATED = "PLAYER_UPDATED"
    PARTICIPANT_JOINED = "PARTICIPANT_JOINED"
    PARTICIPANT_LEFT = "PARTICIPANT_LEFT"
    CHAT_BROADCAST = "CHAT_BROADCAST"
    HEARTBEAT_ACK = "HEARTBEAT_ACK"
    PING_UPDATED = "PING_UPDATED"
    SETTINGS_UPDATED = "SETTINGS_UPDATED"
    ERROR = "ERROR"
    HOST_PROMOTED = "HOST_PROMOTED"


class WebSocketEvent(BaseModel):
    """Format de base d'un message événement WebSocket échangé sur le réseau."""

    model_config = ConfigDict(from_attributes=True)

    event: str = Field(..., description="Nom de l'événement")
    payload: dict[str, Any] = Field(
        default_factory=dict, description="Données associées à l'événement"
    )
    timestamp: int = Field(..., description="Timestamp milliseconde de l'événement")


# --- Payloads Typés pour les Actions Clients ---


class PlayPayload(BaseModel):
    current_time: float = Field(default=0.0, ge=0.0)


class PausePayload(BaseModel):
    current_time: float = Field(default=0.0, ge=0.0)


class SeekPayload(BaseModel):
    target_time: float = Field(..., ge=0.0)


class ChangeMediaPayload(BaseModel):
    url: str = Field(..., min_length=5, max_length=500)


class ChatMessagePayload(BaseModel):
    content: str = Field(..., min_length=1, max_length=500)


class HeartbeatPayload(BaseModel):
    client_sent_at: int = Field(..., ge=0)


class UpdateSettingsPayload(BaseModel):
    is_locked: bool = Field(...)
