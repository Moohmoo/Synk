from abc import ABC, abstractmethod

from domains.media.schemas.media import MediaInfo, MediaType


class BaseExtractor(ABC):
    """Classe de base abstraite pour les extracteurs de médias (Strategy Pattern)."""

    @property
    @abstractmethod
    def name(self) -> str:
        """Nom du fournisseur de média (ex: 'youtube')."""

    @property
    def default_media_type(self) -> MediaType:
        """Type de média par défaut produit par cet extracteur."""
        return MediaType.VIDEO

    @abstractmethod
    def can_handle(self, url: str) -> bool:
        """Indique si cet extracteur sait traiter l'URL fournie."""

    @abstractmethod
    def extract(self, url: str) -> MediaInfo | None:
        """Extrait les informations normalisées du média depuis l'URL."""
