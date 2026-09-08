
from domains.media.extractor import MediaExtractor
from domains.media.extractors.base import BaseExtractor
from domains.media.extractors.youtube import YouTubeExtractor
from domains.media.schemas.media import MediaInfo, MediaType


def test_youtube_extractor_standard_urls():
    extractor = YouTubeExtractor()
    assert extractor.name == "youtube"
    assert extractor.default_media_type == MediaType.VIDEO

    urls = [
        "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
        "http://youtube.com/watch?v=dQw4w9WgXcQ",
        "https://youtu.be/dQw4w9WgXcQ",
        "https://www.youtube.com/embed/dQw4w9WgXcQ",
        "https://www.youtube.com/v/dQw4w9WgXcQ",
        "https://www.youtube.com/shorts/dQw4w9WgXcQ",
    ]

    for url in urls:
        assert extractor.can_handle(url) is True
        info = extractor.extract(url)
        assert info is not None
        assert info.provider == "youtube"
        assert info.media_type == MediaType.VIDEO
        assert info.media_id == "dQw4w9WgXcQ"
        assert info.url == "https://www.youtube.com/watch?v=dQw4w9WgXcQ"


def test_youtube_extractor_with_query_params():
    extractor = YouTubeExtractor()
    urls = [
        "https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=120s&feature=share&si=abc123xyz",
        "https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=RDdQw4w9WgXcQ&start_radio=1",
        "https://www.youtube.com/watch?si=abc123xyz&v=dQw4w9WgXcQ",
        "https://m.youtube.com/watch?v=dQw4w9WgXcQ",
        "https://www.youtube.com/live/dQw4w9WgXcQ",
    ]
    for url in urls:
        assert extractor.can_handle(url) is True
        info = extractor.extract(url)
        assert info is not None
        assert info.media_id == "dQw4w9WgXcQ"
        assert info.url == "https://www.youtube.com/watch?v=dQw4w9WgXcQ"


def test_youtube_extractor_unsupported_urls():
    extractor = YouTubeExtractor()
    invalid_urls = [
        "https://dailymotion.com/video/x7tgad0",
        "https://vimeo.com/76979871",
        "https://not-youtube.com/watch?v=12345678901",
        "just a random string",
        "",
    ]
    for url in invalid_urls:
        assert extractor.can_handle(url) is False
        assert extractor.extract(url) is None


def test_media_extractor_orchestration():
    extractor = MediaExtractor()

    # YouTube support
    info = extractor.extract("https://youtu.be/dQw4w9WgXcQ")
    assert info is not None
    assert info.provider == "youtube"
    assert info.media_id == "dQw4w9WgXcQ"

    # Unsupported URL
    assert extractor.extract("https://unknown-streaming.com/video/123") is None
    assert extractor.extract("") is None


def test_media_extractor_custom_registration():
    """Vérifie l'Open/Closed Principle : enregistrement sans modifier le code existant."""

    class MockSoundCloudExtractor(BaseExtractor):
        @property
        def name(self) -> str:
            return "soundcloud"

        @property
        def default_media_type(self) -> MediaType:
            return MediaType.AUDIO

        def can_handle(self, url: str) -> bool:
            return "soundcloud.com" in url

        def extract(self, url: str) -> MediaInfo | None:
            if not self.can_handle(url):
                return None
            return MediaInfo(
                provider=self.name,
                media_type=self.default_media_type,
                media_id="track_98765",
                url="https://soundcloud.com/artist/track",
            )

    registry = MediaExtractor(extractors=[YouTubeExtractor()])
    registry.register(MockSoundCloudExtractor())

    # Test SoundCloud
    sc_info = registry.extract("https://soundcloud.com/artist/track")
    assert sc_info is not None
    assert sc_info.provider == "soundcloud"
    assert sc_info.media_type == MediaType.AUDIO
    assert sc_info.media_id == "track_98765"

    # Test YouTube reste fonctionnel
    yt_info = registry.extract("https://youtu.be/dQw4w9WgXcQ")
    assert yt_info is not None
    assert yt_info.provider == "youtube"
