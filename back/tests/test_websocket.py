"""Tests d'intégration de bout en bout pour Socket.IO et les événements temps réel."""

import asyncio
import time
from typing import Any

import pytest
import socketio
import uvicorn
from httpx import ASGITransport, AsyncClient

from core.config import settings
from domains.room.schemas.websocket import ClientEventType, ServerEventType
from main import app


class SocketTestClient:
    """Client de test asynchrone pour faciliter les assertions d'événements Socket.IO."""

    def __init__(self, base_url: str):
        self.base_url = base_url
        self.sio = socketio.AsyncClient()
        self.queue: asyncio.Queue[tuple[str, Any]] = asyncio.Queue()

        @self.sio.on("*")
        async def catch_all(event: str, data: Any = None):
            await self.queue.put((event, data))

    async def connect(self, auth: dict[str, Any]) -> None:
        await self.sio.connect(self.base_url, auth=auth)

    async def disconnect(self) -> None:
        if self.sio.connected:
            await self.sio.disconnect()

    async def emit(self, event: str, data: Any = None) -> None:
        await self.sio.emit(event, data)

    async def wait_for_event(self, expected_event: str, timeout: float = 3.0) -> Any:
        start = time.time()
        while time.time() - start < timeout:
            remaining = timeout - (time.time() - start)
            try:
                event, data = await asyncio.wait_for(
                    self.queue.get(), timeout=max(0.1, remaining)
                )
                if event == expected_event:
                    return data
            except TimeoutError:
                break
        raise TimeoutError(
            f"Événement '{expected_event}' non reçu dans le délai imparti ({timeout}s)."
        )


@pytest.mark.asyncio
async def test_socketio_full_lifecycle_and_events():
    """Valide l'orchestration complète du cycle de vie et des événements temps réel Socket.IO."""
    port = 8765
    server_url = f"http://127.0.0.1:{port}"

    config = uvicorn.Config(app, host="127.0.0.1", port=port, log_level="warning")
    server = uvicorn.Server(config)
    server_task = asyncio.create_task(server.serve())

    while not server.started:
        await asyncio.sleep(0.05)

    try:
        # 1. Création d'un salon via l'API HTTP REST
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url=server_url
        ) as http_client:
            create_resp = await http_client.post(
                "/api/v1/rooms", json={"username": "Alice_Host"}
            )
            assert create_resp.status_code == 201
            data = create_resp.json()
            room_id = data["room_id"]
            host_token = data["host_token"]
            user_id = data["user_id"]

        # 2. Refus de connexion à un salon inexistant
        intruder = SocketTestClient(server_url)
        with pytest.raises(socketio.exceptions.ConnectionError):
            await intruder.connect(
                auth={"room_id": "unknown_room_999", "username": "Intruder"}
            )

        # 3. Connexion de l'hôte (Alice)
        alice = SocketTestClient(server_url)
        await alice.connect(
            auth={
                "room_id": room_id,
                "username": "Alice_Host",
                "token": host_token,
                "user_id": user_id,
            }
        )
        alice_sync = await alice.wait_for_event(ServerEventType.ROOM_SYNC)
        assert alice_sync["room"]["room_id"] == room_id
        assert alice_sync["room"]["host_id"] == user_id

        # 4. Connexion d'un invité (Bob)
        bob = SocketTestClient(server_url)
        await bob.connect(auth={"room_id": room_id, "username": "Bob_Guest"})
        bob_sync = await bob.wait_for_event(ServerEventType.ROOM_SYNC)
        assert bob_sync["room"]["room_id"] == room_id

        # Alice reçoit la notification de connexion de Bob
        alice_joined = await alice.wait_for_event(ServerEventType.PARTICIPANT_JOINED)
        assert alice_joined["user"]["username"] == "Bob_Guest"

        # 5. Alice lance la lecture (PLAY)
        await alice.emit(ClientEventType.PLAY, {"current_time": 42.5})
        alice_play = await alice.wait_for_event(ServerEventType.PLAYER_UPDATED)
        bob_play = await bob.wait_for_event(ServerEventType.PLAYER_UPDATED)
        assert alice_play["action"] == "PLAY"
        assert alice_play["current_time"] == 42.5
        assert alice_play["player"]["is_playing"] is True
        assert bob_play["action"] == "PLAY"

        # 5b. Charlie rejoint le salon en cours de lecture
        charlie = SocketTestClient(server_url)
        await charlie.connect(auth={"room_id": room_id, "username": "Charlie_Late"})
        charlie_sync = await charlie.wait_for_event(ServerEventType.ROOM_SYNC)
        assert charlie_sync["room"]["player"]["is_playing"] is True
        assert charlie_sync["room"]["player"]["current_time"] >= 42.5
        await charlie.disconnect()

        # 6. Alice change la vidéo (CHANGE_MEDIA - YouTube)
        await alice.emit(
            ClientEventType.CHANGE_MEDIA,
            {"url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ"},
        )
        alice_media = await alice.wait_for_event(ServerEventType.PLAYER_UPDATED)
        bob_media = await bob.wait_for_event(ServerEventType.PLAYER_UPDATED)
        assert alice_media["media_id"] == "dQw4w9WgXcQ"
        assert bob_media["media_id"] == "dQw4w9WgXcQ"

        # 6b. Alice envoie une URL invalide -> Erreur INVALID_MEDIA_URL
        await alice.emit(
            ClientEventType.CHANGE_MEDIA,
            {"url": "https://not-youtube.com/watch?v=123"},
        )
        alice_media_err = await alice.wait_for_event(ServerEventType.ERROR)
        assert alice_media_err["code"] == "INVALID_MEDIA_URL"

        # 7. Bob envoie un message de chat avec injection XSS potentielle
        await bob.emit(
            ClientEventType.CHAT_MESSAGE,
            {"content": "Salut Alice ! <script>alert(1)</script>"},
        )
        alice_chat = await alice.wait_for_event(ServerEventType.CHAT_BROADCAST)
        bob_chat = await bob.wait_for_event(ServerEventType.CHAT_BROADCAST)
        assert alice_chat["username"] == "Bob_Guest"
        assert "&lt;script&gt;" in alice_chat["content"]
        assert bob_chat["content"] == alice_chat["content"]

        # 8. Bob envoie un Heartbeat
        client_ts = 1772450120000
        await bob.emit(ClientEventType.HEARTBEAT, {"client_sent_at": client_ts})
        bob_ack = await bob.wait_for_event(ServerEventType.HEARTBEAT_ACK)
        assert bob_ack["client_sent_at"] == client_ts

        alice_ping = await alice.wait_for_event(ServerEventType.PING_UPDATED)
        assert alice_ping["user_id"] == bob_sync["your_id"]

        # 9. Alice verrouille le salon (UPDATE_SETTINGS)
        await alice.emit(ClientEventType.UPDATE_SETTINGS, {"is_locked": True})
        alice_lock = await alice.wait_for_event(ServerEventType.SETTINGS_UPDATED)
        bob_lock = await bob.wait_for_event(ServerEventType.SETTINGS_UPDATED)
        assert alice_lock["settings"]["is_locked"] is True
        assert bob_lock["settings"]["is_locked"] is True

        # 10. Bob tente de modifier la lecture pendant le verrouillage -> Refus LOCKED
        await bob.emit(ClientEventType.PLAY, {"current_time": 99.0})
        bob_err = await bob.wait_for_event(ServerEventType.ERROR)
        assert bob_err["code"] == "LOCKED"

        # 11. Alice modifie les paramètres rapidement (déclenchement du Rate Limiter)
        await alice.emit(ClientEventType.UPDATE_SETTINGS, {"is_locked": False})
        await alice.wait_for_event(ServerEventType.SETTINGS_UPDATED)
        await alice.emit(ClientEventType.UPDATE_SETTINGS, {"is_locked": True})
        alice_rate_err = await alice.wait_for_event(ServerEventType.ERROR)
        assert alice_rate_err["code"] == "RATE_LIMITED"
        assert alice_rate_err["action"] == ClientEventType.UPDATE_SETTINGS
        assert alice_rate_err["retry_after"] >= 1

        # 12. Déconnexion de Bob -> Alice est notifiée
        await bob.disconnect()
        alice_left = await alice.wait_for_event(ServerEventType.PARTICIPANT_LEFT)
        assert alice_left["username"] == "Bob_Guest"

        await alice.disconnect()

    finally:
        server.should_exit = True
        await server_task


@pytest.mark.asyncio
async def test_socketio_connect_room_full_refused(monkeypatch):
    """Valide le refus de connexion Socket.IO lorsque la capacité maximale du salon est atteinte."""
    monkeypatch.setattr(settings, "MAX_PARTICIPANTS_PER_ROOM", 1)
    port = 8766
    server_url = f"http://127.0.0.1:{port}"

    config = uvicorn.Config(app, host="127.0.0.1", port=port, log_level="warning")
    server = uvicorn.Server(config)
    server_task = asyncio.create_task(server.serve())

    while not server.started:
        await asyncio.sleep(0.05)

    try:
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url=server_url
        ) as http_client:
            create_resp = await http_client.post(
                "/api/v1/rooms", json={"username": "Alice_Solo"}
            )
            assert create_resp.status_code == 201
            room_data = create_resp.json()
            room_id = room_data["room_id"]
            host_token = room_data["host_token"]
            user_id = room_data["user_id"]

        alice = SocketTestClient(server_url)
        await alice.connect(
            auth={
                "room_id": room_id,
                "username": "Alice_Solo",
                "token": host_token,
                "user_id": user_id,
            }
        )

        bob = SocketTestClient(server_url)
        with pytest.raises(socketio.exceptions.ConnectionError):
            await bob.connect(auth={"room_id": room_id, "username": "Bob_Late"})

        await alice.disconnect()
    finally:
        server.should_exit = True
        await server_task

