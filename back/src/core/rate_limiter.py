"""Limiteur de requêtes utilisant Redis (algorithme Sliding Window)."""

import time
from collections.abc import Callable
from typing import Any

from fastapi import Request
from redis.asyncio import Redis
from redis.exceptions import RedisError

from core.config import settings
from core.exceptions import RateLimitExceededError
from core.logger import logger
from db.database import DatabaseService


def _resolve_ip(direct_ip: str, forwarded: str | None, real_ip: str | None = None) -> str:
    """Résout l'adresse IP cliente réelle en vérifiant la confiance du proxy direct."""
    if direct_ip in settings.TRUSTED_PROXIES:
        if forwarded:
            ips = [ip.strip() for ip in forwarded.split(",") if ip.strip()]
            for ip in reversed(ips):
                if ip not in settings.TRUSTED_PROXIES:
                    return ip
        if real_ip and real_ip.strip():
            return real_ip.strip()
    return direct_ip


def get_client_ip(request: Request) -> str:
    """Extrait l'adresse IP du client HTTP de manière sécurisée (anti-spoofing)."""
    direct_ip = request.client.host if request.client and request.client.host else "127.0.0.1"
    return _resolve_ip(
        direct_ip,
        request.headers.get("x-forwarded-for"),
        request.headers.get("x-real-ip"),
    )


def get_ws_client_ip(environ: dict[str, Any]) -> str:
    """Extrait l'adresse IP du client WebSocket de manière sécurisée (anti-spoofing)."""
    scope = environ.get("asgi.scope")
    if scope and "client" in scope and scope["client"]:
        direct_ip = scope["client"][0]
    else:
        direct_ip = environ.get("REMOTE_ADDR") or "127.0.0.1"

    return _resolve_ip(
        direct_ip,
        environ.get("HTTP_X_FORWARDED_FOR"),
        environ.get("HTTP_X_REAL_IP"),
    )


# Quotas par action WebSocket (défini dans config)
WS_ACTION_LIMITS: dict[str, tuple[int, int]] = settings.WS_ACTION_LIMITS


class RateLimiter:
    """Limiteur de débit distribué basé sur Redis (Sorted Sets)."""

    def __init__(
        self,
        redis_client: Redis | None = None,
        key_prefix: str = "rate_limit",
    ):
        self._custom_redis = redis_client
        self.key_prefix = key_prefix

    @property
    def redis(self) -> Redis:
        """Retourne le client Redis actif."""
        if self._custom_redis is not None:
            return self._custom_redis
        try:
            return DatabaseService().get_redis_client()
        except (RuntimeError, OSError):
            return Redis.from_url(
                settings.REDIS_URL,
                encoding="utf-8",
                decode_responses=True,
            )

    def _get_key(self, identifier: str, action: str) -> str:
        return f"{self.key_prefix}:{action}:{identifier}"

    async def check(
        self,
        identifier: str,
        action: str,
        max_requests: int,
        window_seconds: int,
    ) -> tuple[bool, int]:
        """
        Vérifie si la requête respecte le quota.
        Retourne (autorisé, temps_attente_secondes).
        """
        key = self._get_key(identifier, action)
        now = int(time.time())
        window_start = now - window_seconds

        try:
            pipe = self.redis.pipeline()
            pipe.zremrangebyscore(key, 0, window_start)
            pipe.zcard(key)
            results = await pipe.execute()
            count = results[1]

            if count >= max_requests:
                oldest = await self.redis.zrange(key, 0, 0, withscores=True)
                if oldest:
                    retry_after = max(1, (int(oldest[0][1]) + window_seconds) - now)
                else:
                    retry_after = window_seconds
                return False, retry_after

            pipe = self.redis.pipeline()
            pipe.zadd(key, {f"{now}:{time.time_ns()}": now})
            pipe.expire(key, window_seconds + 1)
            await pipe.execute()

            return True, 0

        except (RedisError, OSError) as e:
            # En cas d'erreur Redis, on autorise (fail-open)
            logger.warning(f"[RATE_LIMIT] Erreur Redis (requête autorisée) : {e}")
            return True, 0

    async def reset(
        self, identifier: str | None = None, action: str | None = None
    ) -> None:
        """Supprime les clés de limitation (utile pour les tests)."""
        pattern = self._get_key(identifier or "*", action or "*")
        keys = await self.redis.keys(pattern)
        if keys:
            await self.redis.delete(*keys)


# Instance globale partagée
rate_limiter = RateLimiter()


def create_http_rate_limiter(
    requests_per_window: int,
    window_seconds: int,
    key_prefix: str,
    error_message: str | None = None,
) -> Callable[[Request], Any]:
    """Fabrique une dépendance FastAPI pour limiter le débit d'une route HTTP."""

    async def dependency(request: Request) -> None:
        client_ip = get_client_ip(request)
        allowed, retry_after = await rate_limiter.check(
            client_ip, key_prefix, requests_per_window, window_seconds
        )
        if not allowed:
            msg = (
                error_message
                or f"Trop de requêtes. Veuillez patienter {retry_after}s avant de réessayer."
            )
            raise RateLimitExceededError(
                message=f"HTTP rate limit exceeded on {key_prefix} for IP {client_ip}",
                retry_after=retry_after,
                public_message=msg,
            )

    return dependency


# Dépendances HTTP réutilisables (Profils)
rate_limit_strict = create_http_rate_limiter(
    requests_per_window=settings.RATE_LIMIT_ROOM_CREATE_PER_MIN,
    window_seconds=60,
    key_prefix="http:strict",
)

rate_limit_standard = create_http_rate_limiter(
    requests_per_window=settings.RATE_LIMIT_ROOM_CHECK_PER_MIN,
    window_seconds=60,
    key_prefix="http:standard",
)


async def check_ws_rate_limit(user_id: str, action: str) -> tuple[bool, int]:
    """Vérifie les quotas global et par action pour un événement WebSocket."""
    allowed, wait_sec = await rate_limiter.check(
        user_id, "global", settings.WS_RATE_LIMIT_BURST, 1
    )
    if not allowed:
        return False, wait_sec

    limit = settings.WS_ACTION_LIMITS.get(action)
    if limit:
        max_req, window = limit
        return await rate_limiter.check(user_id, action, max_req, window)

    return True, 0
