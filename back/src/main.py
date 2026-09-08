from contextlib import asynccontextmanager
from typing import Any

import socketio
from fastapi import FastAPI
from fastapi.responses import JSONResponse
from redis.exceptions import RedisError
from starlette.middleware.cors import CORSMiddleware

from api import room
from core.config import settings
from core.error_handlers import register_exception_handlers
from core.logger import logger
from db.database import DatabaseService
from domains.room.websocket import sio


@asynccontextmanager
async def lifespan(_app: FastAPI):
    """Initialise les connexions Redis au démarrage et les ferme à l'arrêt."""
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

register_exception_handlers(app)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routes HTTP REST des salons
app.include_router(room.router, prefix="/api/v1/rooms")

# Socket.IO pour le temps réel
app.mount("/socket.io", socketio.ASGIApp(sio))


@app.get("/health", tags=["Health"])
@app.get("/healthz", tags=["Health"], include_in_schema=False)
async def health_check() -> JSONResponse:
    """Vérifie la santé du serveur et de Redis."""
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
    """Route d'accueil de diagnostic."""
    logger.info("Route racine accédée")
    return {
        "message": "Synk API is running !",
        "version": settings.VERSION,
        "status": "online",
    }
