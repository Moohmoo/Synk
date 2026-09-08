from contextlib import asynccontextmanager
from typing import Any

from fastapi import FastAPI
from fastapi.responses import JSONResponse
from redis.exceptions import RedisError
from starlette.middleware.cors import CORSMiddleware

from api import room
from core.config import settings
from core.error_handlers import register_exception_handlers
from core.logger import logger
from db.database import DatabaseService


@asynccontextmanager
async def lifespan(_app: FastAPI):
    """
    Gestionnaire de cycle de vie de l'application FastAPI.
    Initialise le pool Redis au démarrage et libère les connexions à l'arrêt.
    """
    logger.info(
        f"[STARTUP] Démarrage de {settings.PROJECT_NAME} v{settings.VERSION} ({settings.ENV})"
    )

    try:
        await DatabaseService.init_databases()
    except (RedisError, OSError, RuntimeError) as e:
        logger.warning(f"[STARTUP] Connexion initiale à Redis non établie : {e}")

    yield

    await DatabaseService.close_databases()
    logger.info(
        f"[SHUTDOWN] Arrêt de {settings.PROJECT_NAME} et libération des ressources"
    )


app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    lifespan=lifespan,
    redirect_slashes=False,
)

# Enregistrement du gestionnaire d'exceptions global (Single Responsibility)
register_exception_handlers(app)

# Configuration Middleware CORS (Supporte localhost et le frontend configuré)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routeur unifié pour le domaine des salons (REST et WebSocket /ws)
app.include_router(room.router, prefix="/api/v1/rooms")


@app.get("/health", tags=["Health"])
@app.get("/healthz", tags=["Health"], include_in_schema=False)
async def health_check() -> JSONResponse:
    """
    Endpoint de santé (Health Check) pour Docker, reverse proxy et monitoring.
    Vérifie la réactivité du serveur et teste la connectivité du pool Redis.
    """
    health: dict[str, Any] = {
        "status": "ok",
        "app": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "environment": settings.ENV,
        "services": {},
    }

    status_code = 200

    try:
        client = DatabaseService().get_redis_client()
        await client.ping()
        health["services"]["redis"] = "ok"
    except (RedisError, OSError, RuntimeError) as e:
        health["services"]["redis"] = f"unhealthy: {e}"
        health["status"] = "degraded"
        status_code = 503

    return JSONResponse(content=health, status_code=status_code)


@app.get("/", tags=["Root"])
async def root() -> dict[str, str]:
    """Route racine pour vérification rapide et diagnostic."""
    logger.info("Route racine accédée")
    return {
        "message": "Synk API is running !",
        "version": settings.VERSION,
        "status": "online",
    }
