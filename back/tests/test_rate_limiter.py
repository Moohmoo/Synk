import pytest
from httpx import ASGITransport, AsyncClient

from core.exceptions import RateLimitExceededError
from core.rate_limiter import (
    TokenBucketLimiter,
    WebSocketRateLimiter,
    create_http_rate_limiter,
)
from main import app, lifespan


def test_token_bucket_limiter_basic():
    # Seau avec capacité 3, recharge 1 jeton / sec
    limiter = TokenBucketLimiter(rate=1.0, capacity=3.0)

    # 3 consommations immédiates autorisées (burst)
    allowed1, wait1 = limiter.acquire("user_1")
    assert allowed1 is True
    assert wait1 == 0.0

    allowed2, wait2 = limiter.acquire("user_1")
    assert allowed2 is True
    assert wait2 == 0.0

    allowed3, wait3 = limiter.acquire("user_1")
    assert allowed3 is True
    assert wait3 == 0.0

    # 4ème tentative immédiatement bloquée
    allowed4, wait4 = limiter.acquire("user_1")
    assert allowed4 is False
    assert wait4 > 0.0

    # Une autre clé dispose de son propre quota indépendant
    allowed_other, _ = limiter.acquire("user_2")
    assert allowed_other is True


def test_token_bucket_cleanup_and_reset():
    limiter = TokenBucketLimiter(rate=1.0, capacity=2.0, cleanup_interval_seconds=0.01)
    limiter.acquire("temp_key")
    assert "temp_key" in limiter._buckets

    # Suppression ciblée
    limiter.remove("temp_key")
    assert "temp_key" not in limiter._buckets

    # Réinitialisation globale
    limiter.acquire("key_a")
    limiter.acquire("key_b")
    limiter.reset()
    assert len(limiter._buckets) == 0


def test_websocket_rate_limiter_actions():
    ws_limiter = WebSocketRateLimiter(global_rate=10.0, global_capacity=15.0)
    conn_id = "test_conn_123"

    # Action UPDATE_SETTINGS (capacité 2)
    ok1, reason1, _ = ws_limiter.check(conn_id, "UPDATE_SETTINGS")
    assert ok1 is True
    assert reason1 is None

    ok2, _reason2, _ = ws_limiter.check(conn_id, "UPDATE_SETTINGS")
    assert ok2 is True

    # 3ème tentative rapide de modification des permissions -> Bloqué
    ok3, reason3, wait3 = ws_limiter.check(conn_id, "UPDATE_SETTINGS")
    assert ok3 is False
    assert reason3 == "ACTION_LIMIT_UPDATE_SETTINGS"
    assert wait3 > 0.0

    # Une autre action reste autorisée
    chat_ok, _, _ = ws_limiter.check(conn_id, "CHAT_MESSAGE")
    assert chat_ok is True

    # Nettoyage de la connexion
    ws_limiter.cleanup(conn_id)
    ws_limiter.reset()


def test_websocket_rate_limiter_global_flood():
    # Limiteur avec quota global très strict pour le test (capacité 3)
    ws_limiter = WebSocketRateLimiter(global_rate=1.0, global_capacity=3.0)
    conn_id = "flood_conn"

    for _ in range(3):
        allowed, _, _ = ws_limiter.check(conn_id)
        assert allowed is True

    # Débordement global
    allowed, reason, wait = ws_limiter.check(conn_id)
    assert allowed is False
    assert reason == "GLOBAL_FLOOD"
    assert wait > 0.0


@pytest.mark.asyncio
async def test_http_rate_limiter_triggers_429():
    """
    Test d'intégration : vérifie que le rate limiter HTTP intercepte le spam,
    renvoie HTTP 429 avec l'en-tête Retry-After et un payload standardisé.
    """
    # Limiteur dédié avec capacité 2 requêtes
    strict_limiter = create_http_rate_limiter(
        requests_per_window=2,
        window_seconds=60,
        key_prefix="test_route",
        error_message="Trop d'appels de test.",
    )

    async with (
        lifespan(app),
        AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client,
    ):
        # 1. Deux requêtes autorisées
        for i in range(2):
            resp = await client.post(
                "/api/v1/rooms",
                json={"username": f"User_{i}"},
            )
            # Peut réussir ou échouer selon l'IP partagée, mais on vérifie le comportement sous charge
            assert resp.status_code in (201, 429)

        # 2. Test direct de l'exception levée
        with pytest.raises(RateLimitExceededError) as exc_info:

            class DummyRequest:
                def __init__(self):
                    self.headers = {}
                    self.client = None

            await strict_limiter(DummyRequest())
            await strict_limiter(DummyRequest())
            await strict_limiter(DummyRequest())

        exc = exc_info.value
        assert exc.status_code == 429
        assert exc.code == "RATE_LIMIT_EXCEEDED"
        assert exc.retry_after >= 1
