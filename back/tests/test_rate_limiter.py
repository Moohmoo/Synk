import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from redis.asyncio import Redis

from core.config import settings
from core.exceptions import RateLimitExceededError
from core.rate_limiter import (
    RateLimiter,
    check_ws_rate_limit,
    create_http_rate_limiter,
    get_client_ip,
    get_ws_client_ip,
    rate_limiter,
)
from main import app, lifespan


@pytest_asyncio.fixture
async def redis_client():
    client = Redis.from_url(settings.REDIS_URL, decode_responses=True)
    yield client
    await client.aclose()


@pytest.mark.asyncio
async def test_sliding_window_rate_limiter_basic(redis_client):
    """Valide les quotas de base et le blocage au-delà du seuil maximal."""
    limiter = RateLimiter(redis_client=redis_client, key_prefix="test_basic")
    await limiter.reset("user_1", "action_a")
    await limiter.reset("user_2", "action_a")

    # 3 requêtes autorisées
    for _ in range(3):
        allowed, wait = await limiter.check(
            identifier="user_1",
            action="action_a",
            max_requests=3,
            window_seconds=2,
        )
        assert allowed is True
        assert wait == 0

    # 4ème requête bloquée
    allowed, wait = await limiter.check(
        identifier="user_1",
        action="action_a",
        max_requests=3,
        window_seconds=2,
    )
    assert allowed is False
    assert wait >= 1

    # Une autre clé dispose de son propre quota indépendant
    allowed_other, _ = await limiter.check(
        identifier="user_2",
        action="action_a",
        max_requests=3,
        window_seconds=2,
    )
    assert allowed_other is True

    await limiter.reset("user_1", "action_a")
    await limiter.reset("user_2", "action_a")


@pytest.mark.asyncio
async def test_sliding_window_rate_limiter_reset(redis_client):
    """Valide la réinitialisation manuelle des clés Redis du limiteur."""
    limiter = RateLimiter(redis_client=redis_client, key_prefix="test_reset")
    await limiter.reset("temp_user", "ping")

    allowed, _ = await limiter.check(
        "temp_user", "ping", max_requests=1, window_seconds=60
    )
    assert allowed is True

    # 2ème bloquée
    allowed2, _ = await limiter.check(
        "temp_user", "ping", max_requests=1, window_seconds=60
    )
    assert allowed2 is False

    # Réinitialisation
    await limiter.reset("temp_user", "ping")

    # À nouveau autorisée
    allowed3, _ = await limiter.check(
        "temp_user", "ping", max_requests=1, window_seconds=60
    )
    assert allowed3 is True

    await limiter.reset("temp_user", "ping")


@pytest.mark.asyncio
async def test_websocket_rate_limiter_actions(redis_client):
    """Valide le cloisonnement des quotas par type d'action."""
    limiter = RateLimiter(redis_client=redis_client, key_prefix="test_ws")
    user_id = "test_ws_user"
    await limiter.reset(user_id)

    # UPDATE_SETTINGS (max 2)
    ok1, _ = await limiter.check(
        user_id, "UPDATE_SETTINGS", max_requests=2, window_seconds=2
    )
    ok2, _ = await limiter.check(
        user_id, "UPDATE_SETTINGS", max_requests=2, window_seconds=2
    )
    assert ok1 is True
    assert ok2 is True

    # 3ème tentative rapide -> bloquée
    ok3, wait3 = await limiter.check(
        user_id, "UPDATE_SETTINGS", max_requests=2, window_seconds=2
    )
    assert ok3 is False
    assert wait3 >= 1

    # Une autre action reste autorisée
    chat_ok, _ = await limiter.check(
        user_id, "CHAT_MESSAGE", max_requests=5, window_seconds=5
    )
    assert chat_ok is True

    # Validation directe de check_ws_rate_limit avec les quotas par défaut
    ws_user = "test_check_ws_user"
    await rate_limiter.reset(ws_user)
    assert (await check_ws_rate_limit(ws_user, "PLAY"))[0] is True
    assert (await check_ws_rate_limit(ws_user, "PLAY"))[0] is True
    assert (await check_ws_rate_limit(ws_user, "PLAY"))[0] is True
    allowed_play_4, wait_play = await check_ws_rate_limit(ws_user, "PLAY")
    assert allowed_play_4 is False
    assert wait_play >= 1
    await rate_limiter.reset(ws_user)

    await limiter.reset(user_id)


@pytest.mark.asyncio
async def test_http_rate_limiter_triggers_429(redis_client):
    """Vérifie que le limiteur HTTP intercepte le spam et renvoie un statut 429."""
    strict_limiter = create_http_rate_limiter(
        requests_per_window=2,
        window_seconds=60,
        key_prefix="test_route",
        error_message="Trop d'appels de test.",
    )
    test_limiter = RateLimiter(redis_client=redis_client)
    await test_limiter.reset("127.0.0.1", "test_route")

    async with (
        lifespan(app),
        AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client,
    ):
        # Vérifie que la route HTTP fonctionne
        resp = await client.post("/api/v1/rooms", json={"username": "User_Rate_Test"})
        assert resp.status_code in (201, 429)

        # Vérifie le déclenchement de l'exception métier 429
        class DummyRequest:
            def __init__(self):
                self.headers = {}
                self.client = None

        with pytest.raises(RateLimitExceededError) as exc_info:
            await strict_limiter(DummyRequest())
            await strict_limiter(DummyRequest())
            await strict_limiter(DummyRequest())

        exc = exc_info.value
        assert exc.status_code == 429
        assert exc.code == "RATE_LIMIT_EXCEEDED"
        assert exc.retry_after >= 1

    await test_limiter.reset("127.0.0.1", "test_route")


def test_get_client_ip_anti_spoofing():
    """Valide que les en-têtes X-Forwarded-For forgés sont ignorés pour les clients non-proxys."""
    class MockClient:
        def __init__(self, host: str):
            self.host = host

    class MockRequest:
        def __init__(self, host: str, headers: dict[str, str]):
            self.client = MockClient(host)
            self.headers = headers

    # 1. Client direct non-proxy forgant X-Forwarded-For -> ignoré, IP réelle conservée
    untrusted = MockRequest("198.51.100.22", {"x-forwarded-for": "10.0.0.1, 10.0.0.2"})
    assert get_client_ip(untrusted) == "198.51.100.22"

    # 2. Proxy local de confiance -> extrait la véritable IP cliente externe
    trusted = MockRequest("127.0.0.1", {"x-forwarded-for": "203.0.113.195, 127.0.0.1"})
    assert get_client_ip(trusted) == "203.0.113.195"

    # 3. Client direct sans headers -> IP directe
    direct = MockRequest("192.168.1.50", {})
    assert get_client_ip(direct) == "192.168.1.50"


def test_get_ws_client_ip_anti_spoofing():
    """Valide la résolution d'IP anti-spoofing pour les connexions WebSocket."""
    # 1. Non-proxy avec header HTTP_X_FORWARDED_FOR forgé
    environ_untrusted = {
        "REMOTE_ADDR": "198.51.100.5",
        "HTTP_X_FORWARDED_FOR": "10.0.0.1",
    }
    assert get_ws_client_ip(environ_untrusted) == "198.51.100.5"

    # 2. Proxy local de confiance avec proxy ASGI scope client
    environ_trusted = {
        "asgi.scope": {"client": ("127.0.0.1", 54321)},
        "HTTP_X_FORWARDED_FOR": "203.0.113.88, 127.0.0.1",
    }
    assert get_ws_client_ip(environ_trusted) == "203.0.113.88"

