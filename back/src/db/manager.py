from redis.asyncio import Redis

from db.database import DatabaseService
from domains.room.crud import RoomService


class DatabaseManager:
    """
    Unit of Work / Gestionnaire centralisé de persistance.
    Fournit un point d'accès unique et découplé aux services de données des domaines.

    Architecture multi-bases :
    - Services éphémères / temps réel (ex: room_service) branchés sur Redis
    - Futurs services persistants (ex: user_service, history_service) branchés sur SQL
    """

    def __init__(self):
        self.db_service = DatabaseService()
        self.redis: Redis | None = None
        self.room_service: RoomService | None = None

    def __enter__(self):
        # 1. Connexion au store temps réel Redis
        self.redis = self.db_service.get_redis_client()

        # 2. Instanciation des services de domaine
        self.room_service = RoomService(self.redis)

        # Pour brancher une future base SQL :
        # - Récupérer la session : self.sql_session = self.db_service.get_sql_session()
        # - Instancier le service : self.user_service = UserService(self.sql_session)

        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        # Point d'ancrage transactionnel pour futur rollback/close SQL si nécessaire
        pass

    async def __aenter__(self):
        return self.__enter__()

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        return self.__exit__(exc_type, exc_val, exc_tb)
