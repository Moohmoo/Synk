from collections.abc import Sequence

from core.logger import logger
from domains.media.extractors.base import BaseExtractor
from domains.media.extractors.youtube import YouTubeExtractor
from domains.media.schemas.media import MediaInfo


class MediaExtractor:
    """
    Gestionnaire central des extracteurs multimédia.

    Orchestre la détection de la plateforme et l'extraction des identifiants
    canoniques via le Strategy Pattern.
    """

    def __init__(self, extractors: Sequence[BaseExtractor] | None = None) -> None:
        self._extractors: list[BaseExtractor] = (
            list(extractors) if extractors is not None else [YouTubeExtractor()]
        )

    def register(self, extractor: BaseExtractor) -> None:
        """Enregistre un nouvel extracteur de média dans le catalogue."""
        self._extractors.append(extractor)
        logger.info(f"Extracteur média enregistré : {extractor.name}")

    def extract(self, url: str) -> MediaInfo | None:
        """
        Identifie le fournisseur compatible et extrait les informations normalisées.

        Retourne None si aucune stratégie ne peut prendre en charge l'URL.
        """
        if not url or not isinstance(url, str):
            return None

        cleaned_url = url.strip()
        for extractor in self._extractors:
            info = extractor.extract(cleaned_url)
            if info:
                logger.debug(f"Média extrait [{info.provider}] ID: {info.media_id}")
                return info
        return None


# Instance partagée prête à l'emploi
media_extractor = MediaExtractor()
