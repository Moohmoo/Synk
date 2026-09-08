from enum import StrEnum

from pydantic import BaseModel, ConfigDict, Field


class MediaType(StrEnum):
    """Types de flux multimédia pris en charge."""

    VIDEO = "video"
    AUDIO = "audio"
    STREAM = "stream"


class MediaInfo(BaseModel):
    """Métadonnées normalisées extraites d'une URL de média."""

    model_config = ConfigDict(from_attributes=True)

    provider: str = Field(
        ...,
        description="Identifiant de la plateforme (ex: 'youtube', 'soundcloud')",
    )
    media_type: MediaType = Field(
        default=MediaType.VIDEO,
        description="Catégorie du média (vidéo, audio ou flux en direct)",
    )
    media_id: str = Field(
        ...,
        description="Identifiant unique et canonique du média sur sa plateforme",
    )
    url: str = Field(
        ...,
        description="URL normalisée du média",
    )
    title: str | None = Field(
        default=None,
        description="Titre du média si extrait",
    )
