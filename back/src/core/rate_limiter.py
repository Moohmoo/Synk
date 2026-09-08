import math
import time
from collections.abc import Callable
from dataclasses import dataclass

from fastapi import Request

from core.exceptions import RateLimitExceededError


@dataclass
class Bucket:
    tokens: float
    last_update: float


class TokenBucketLimiter:
    """
    Gestionnaire générique d'algorithme Token Bucket en mémoire (In-Memory).
    - O(1) par vérification, latence sub-microseconde, 0 I/O réseau.
    - Permet des rafales naturelles et fluides (capacity) tout en garantissant un débit moyen soutenu (rate).
    - Auto-nettoyage des buckets inactifs pour prémunir toute fuite mémoire.
    """

    def __init__(
        self,
        rate: float,
        capacity: float,
        cleanup_interval_seconds: float = 300.0,
    ):
        """
        :param rate: Nombre de jetons rechargés par seconde (débit moyen).
        :param capacity: Capacité maximale du seau (rafale / burst autorisé).
        :param cleanup_interval_seconds: Intervalle de purge des clés inactives.
        """
        self.rate = float(rate)
        self.capacity = float(capacity)
        self.cleanup_interval = float(cleanup_interval_seconds)
        self._buckets: dict[str, Bucket] = {}
        self._last_cleanup = time.monotonic()

    def acquire(self, key: str, tokens: float = 1.0) -> tuple[bool, float]:
        """
        Tente de consommer des jetons pour une clé donnée.
        :return: (autorisé, temps_attente_secondes)
        """
        now = time.monotonic()
        self._maybe_cleanup(now)

        bucket = self._buckets.get(key)
        if bucket is None:
            bucket = Bucket(tokens=self.capacity, last_update=now)
            self._buckets[key] = bucket

        # Rechargement des jetons proportionnel au temps écoulé
        elapsed = now - bucket.last_update
        bucket.last_update = now
        bucket.tokens = min(self.capacity, bucket.tokens + elapsed * self.rate)

        if bucket.tokens >= tokens:
            bucket.tokens -= tokens
            return True, 0.0

        wait_seconds = (tokens - bucket.tokens) / self.rate if self.rate > 0 else 1.0
        return False, wait_seconds

    def remove(self, key: str) -> None:
        """Supprime une clé du gestionnaire (ex: déconnexion socket)."""
        self._buckets.pop(key, None)

    def reset(self) -> None:
        """Réinitialise tous les seaux (essentiel pour l'isolation des tests unitaires)."""
        self._buckets.clear()

    def _maybe_cleanup(self, now: float) -> None:
        """Purge les seaux inactifs depuis plus de 2x la durée de remplissage complet."""
        if now - self._last_cleanup < self.cleanup_interval:
            return

        self._last_cleanup = now
        max_idle = (self.capacity / self.rate) * 2.0 if self.rate > 0 else 60.0
        stale_keys = [
            k for k, b in self._buckets.items() if (now - b.last_update) > max_idle
        ]
        for k in stale_keys:
            self._buckets.pop(k, None)


def get_client_ip(request: Request) -> str:
    """Extrait l'adresse IP client avec prise en charge des proxys inverses (X-Forwarded-For)."""
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        client_ip = forwarded.split(",")[0].strip()
        if client_ip:
            return client_ip
    if request.client and request.client.host:
        return request.client.host
    return "127.0.0.1"


def create_http_rate_limiter(
    requests_per_window: int,
    window_seconds: int,
    key_prefix: str,
    error_message: str | None = None,
) -> Callable[[Request], None]:
    """
    Fabrique une dépendance FastAPI réutilisable pour brider un endpoint HTTP par adresse IP.
    """
    rate = requests_per_window / window_seconds
    limiter = TokenBucketLimiter(rate=rate, capacity=float(requests_per_window))

    async def dependency(request: Request) -> None:
        client_ip = get_client_ip(request)
        key = f"{key_prefix}:{client_ip}"
        allowed, wait_time = limiter.acquire(key)
        if not allowed:
            retry_after = max(1, math.ceil(wait_time))
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


class WebSocketRateLimiter:
    """
    Gestionnaire centralisé du bridage de trafic WebSocket.
    Fournit une double barrière défensive :
    1. Quota global de trames par socket (protection anti-flood / DoS).
    2. Quota granulaire par action métier (anti-spam Play/Pause, Lock/Unlock, Seek, etc.).
    """

    def __init__(
        self,
        global_rate: float = 10.0,
        global_capacity: float = 15.0,
    ):
        self.global_limiter = TokenBucketLimiter(
            rate=global_rate, capacity=global_capacity
        )
        # Limiteurs spécialisés par action : capacité (burst) et recharge par seconde
        self.action_limiters: dict[str, TokenBucketLimiter] = {
            "UPDATE_SETTINGS": TokenBucketLimiter(rate=1.0, capacity=2.0),
            "CHANGE_MEDIA": TokenBucketLimiter(rate=0.5, capacity=2.0),
            "PLAY_PAUSE": TokenBucketLimiter(rate=2.0, capacity=3.0),
            "SEEK": TokenBucketLimiter(rate=3.0, capacity=4.0),
            "CHAT_MESSAGE": TokenBucketLimiter(rate=1.0, capacity=5.0),
            "HEARTBEAT": TokenBucketLimiter(rate=0.5, capacity=2.0),
        }

    def check(
        self,
        connection_id: str,
        action: str | None = None,
    ) -> tuple[bool, str | None, float]:
        """
        Vérifie si le message entrant est autorisé.
        :return: (autorisé, code_erreur_si_bloqué, temps_attente_secondes)
        """
        # 1. Vérification du débit global de la connexion
        allowed, wait = self.global_limiter.acquire(connection_id)
        if not allowed:
            return False, "GLOBAL_FLOOD", wait

        # 2. Vérification granulaire par type d'action métier
        if action:
            limiter_key = action
            if action in ("PLAY", "PAUSE"):
                limiter_key = "PLAY_PAUSE"

            limiter = self.action_limiters.get(limiter_key)
            if limiter:
                action_conn_key = f"{connection_id}:{limiter_key}"
                action_allowed, action_wait = limiter.acquire(action_conn_key)
                if not action_allowed:
                    return False, f"ACTION_LIMIT_{limiter_key}", action_wait

        return True, None, 0.0

    def cleanup(self, connection_id: str) -> None:
        """Nettoie tous les seaux associés à une connexion fermée."""
        self.global_limiter.remove(connection_id)
        for limiter_key, limiter in self.action_limiters.items():
            limiter.remove(f"{connection_id}:{limiter_key}")

    def reset(self) -> None:
        """Réinitialise tous les seaux (pour les tests)."""
        self.global_limiter.reset()
        for limiter in self.action_limiters.values():
            limiter.reset()
