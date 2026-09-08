from abc import ABC, abstractmethod

from domains.media.schemas.media import MediaInfo, MediaType


class BaseExtractor(ABC):
    """Classe de base pour les extracteurs de médias (Strategy Pattern)."""

    name: str = ""
    default_media_type: MediaType = MediaType.VIDEO

    def can_handle(self, url: str) -> bool:
        """Indique si cet extracteur sait traiter l'URL fournie."""
        return self.extract(url) is not None

    @abstractmethod
    def extract(self, url: str) -> MediaInfo | None:
        """Extrait les informations normalisées du média depuis l'URL."""
