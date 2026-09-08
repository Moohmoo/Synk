"""Configuration du serveur temps réel Socket.IO."""

import socketio

from core.config import settings

# Relais Redis pour le multi-instances
_redis_manager = (
    socketio.AsyncRedisManager(settings.REDIS_URL) if settings.REDIS_URL else None
)

# Instance partagée du serveur Socket.IO
sio = socketio.AsyncServer(
    async_mode="asgi",
    client_manager=_redis_manager,
    cors_allowed_origins="*",
    max_http_buffer_size=settings.WS_MAX_PAYLOAD_SIZE,
)
