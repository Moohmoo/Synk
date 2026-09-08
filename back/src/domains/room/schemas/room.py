import time

from pydantic import BaseModel, ConfigDict, Field


class RoomSettings(BaseModel):
    """Paramètres de configuration du salon."""

    model_config = ConfigDict(from_attributes=True)

    is_locked: bool = Field(
        default=False,
        description="Indique si les invités ont interdiction de contrôler la lecture (mode hôte uniquement)",
    )


class PlayerState(BaseModel):
    """État actuel du lecteur multimédia dans le salon."""

    model_config = ConfigDict(from_attributes=True)

    media_url: str | None = Field(
        default=None,
        description="URL complète du média en cours (ex: YouTube, SoundCloud)",
    )
    media_id: str | None = Field(
        default=None,
        description="Identifiant unique du média extrait",
    )
    provider: str | None = Field(
        default=None,
        description="Plateforme de diffusion du média (ex: 'youtube', 'soundcloud')",
    )
    media_type: str | None = Field(
        default=None,
        description="Type de flux ('video', 'audio', 'stream')",
    )
    is_playing: bool = Field(
        default=False,
        description="Indique si le média est actuellement en cours de lecture",
    )
    current_time: float = Field(
        default=0.0,
        description="Position actuelle de lecture en secondes",
    )
    duration: float = Field(
        default=0.0,
        description="Durée totale du média en secondes",
    )
    last_updated_at: int = Field(
        default_factory=lambda: int(time.time() * 1000),
        description="Timestamp milliseconde du dernier changement d'état du lecteur",
    )


class Participant(BaseModel):
    """Représentation d'un utilisateur connecté dans un salon."""

    model_config = ConfigDict(from_attributes=True)

    id: str = Field(
        ...,
        description="Identifiant unique de l'utilisateur (ex: usr_99a8b7)",
    )
    username: str = Field(
        ...,
        min_length=2,
        max_length=30,
        description="Pseudo de l'utilisateur",
    )
    is_host: bool = Field(
        default=False,
        description="Indique si l'utilisateur est le créateur / hôte du salon",
    )
    joined_at: int = Field(
        default_factory=lambda: int(time.time() * 1000),
        description="Timestamp milliseconde de connexion au salon",
    )
    ping_ms: int = Field(
        default=0,
        description="Latence réseau mesurée en millisecondes",
    )


class Room(BaseModel):
    """Entité salon complète et distribuée stockée dans Redis."""

    model_config = ConfigDict(from_attributes=True)

    room_id: str = Field(
        ...,
        description="Identifiant unique du salon (ex: k8F-2mX9-L1q)",
    )
    created_at: int = Field(
        default_factory=lambda: int(time.time() * 1000),
        description="Timestamp milliseconde de création du salon",
    )
    host_id: str = Field(
        ...,
        description="Identifiant du participant possédant les droits d'hôte",
    )
    settings: RoomSettings = Field(
        default_factory=RoomSettings,
        description="Paramètres de configuration du salon",
    )
    player: PlayerState = Field(
        default_factory=PlayerState,
        description="État du lecteur multimédia du salon",
    )
    participants: list[Participant] = Field(
        default_factory=list,
        description="Liste des participants actifs dans le salon",
    )
