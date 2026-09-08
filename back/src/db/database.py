from redis.asyncio import Redis

from core.config import settings
from core.logger import logger


class DatabaseService:
    """
    Service centralisé de gestion des connexions aux bases de données.
    Gère les pools et connexions des moteurs de stockage de l'application :
    - Actuel : Redis (clé-valeur, état en mémoire, pub/sub temps réel)
    - Extension future : Base relationnelle SQL (PostgreSQL via SQLAlchemy)
    """

    _redis_client: Redis | None = None

    def __init__(self):
        pass

    @classmethod
    async def init_databases(cls) -> Redis:
        """
        Initialise les connexions aux bases de données configurées.
        Appelé une seule fois au démarrage de l'application (FastAPI lifespan).
        """
        if cls._redis_client is None:
            cls._redis_client = Redis.from_url(
                settings.REDIS_URL,
                encoding="utf-8",
                decode_responses=True,
                max_connections=50,
                socket_connect_timeout=2.0,
            )
            await cls._redis_client.ping()
            logger.success(f"Connexion au pool Redis établie ({settings.REDIS_URL})")

        return cls._redis_client

    @classmethod
    async def close_databases(cls) -> None:
        """Ferme proprement tous les pools et connexions de bases de données."""
        if cls._redis_client is not None:
            await cls._redis_client.aclose()
            cls._redis_client = None
            logger.info("Pool de connexions Redis fermé")

    def get_redis_client(self) -> Redis:
        """Retourne l'instance active du client Redis issu du pool."""
        if self._redis_client is None:
            raise RuntimeError(
                "Le client Redis n'est pas initialisé. Vérifiez le lifespan de l'application."
            )
        return self._redis_client
