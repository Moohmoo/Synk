import re
from urllib.parse import parse_qs, urlparse

from domains.media.extractors.base import BaseExtractor
from domains.media.schemas.media import MediaInfo, MediaType


class YouTubeExtractor(BaseExtractor):
    """Extracteur dédié aux contenus de la plateforme YouTube."""

    VIDEO_ID_REGEX = re.compile(r"^[a-zA-Z0-9_-]{11}$")

    @property
    def name(self) -> str:
        return "youtube"

    @property
    def default_media_type(self) -> MediaType:
        return MediaType.VIDEO

    def _extract_video_id(self, url: str) -> str | None:
        if not url or not isinstance(url, str):
            return None

        clean_url = url.strip()
        if not clean_url.startswith(("http://", "https://")):
            clean_url = "https://" + clean_url

        try:
            parsed = urlparse(clean_url)
        except (ValueError, AttributeError):
            return None

        hostname = (parsed.hostname or "").lower().removeprefix("www.")

        # Domaines autorisés
        if hostname not in ("youtube.com", "m.youtube.com", "music.youtube.com", "youtu.be"):
            return None

        video_id = None
        if hostname == "youtu.be":
            path_parts = parsed.path.strip("/").split("/")
            if path_parts and path_parts[0]:
                video_id = path_parts[0]
        else:
            path = parsed.path.rstrip("/")
            if path == "/watch":
                qs = parse_qs(parsed.query)
                v_list = qs.get("v")
                if v_list and v_list[0]:
                    video_id = v_list[0]
            elif path.startswith(("/embed/", "/v/", "/shorts/", "/live/")):
                parts = path.split("/")
                if len(parts) >= 3 and parts[2]:
                    video_id = parts[2]

        if video_id and self.VIDEO_ID_REGEX.fullmatch(video_id):
            return video_id
        return None

    def can_handle(self, url: str) -> bool:
        """Vérifie si l'URL correspond au domaine YouTube et contient un ID valide."""
        return self._extract_video_id(url) is not None

    def extract(self, url: str) -> MediaInfo | None:
        """Extrait l'ID de 11 caractères et génère l'URL canonique de visionnage."""
        video_id = self._extract_video_id(url)
        if not video_id:
            return None

        canonical_url = f"https://www.youtube.com/watch?v={video_id}"

        return MediaInfo(
            provider=self.name,
            media_type=self.default_media_type,
            media_id=video_id,
            url=canonical_url,
        )
