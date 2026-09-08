import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from redis.asyncio import Redis

from core.config import settings
from domains.room.schemas.room import Room
from main import app, lifespan


@pytest_asyncio.fixture
async def redis_client():
    client = Redis.from_url(settings.REDIS_URL, decode_responses=True)
    yield client
    await client.aclose()


@pytest.mark.asyncio
async def test_post_create_room_inserts_valid_data_in_redis(redis_client):
    """
    Test d'intégration : valide que l'appel HTTP POST /api/v1/rooms
    crée bien le salon et insère un JSON valide dans la clé Redis 'room:{room_id}'.
    """
    async with (
        lifespan(app),
        AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client,
    ):
        # 1. Appel HTTP de création de salon
        response = await client.post("/api/v1/rooms", json={"username": "Alice_Tester"})
        assert response.status_code == 201

        data = response.json()
        room_id = data["room_id"]
        host_token = data["host_token"]
        user_id = data["user_id"]

        assert room_id is not None
        assert host_token.startswith("tok_sec_")
        assert user_id.startswith("usr_")

        # 2. Vérification directe dans Redis
        raw_redis_data = await redis_client.get(f"room:{room_id}")
        assert raw_redis_data is not None

        # Vérification de la structure et validation via Room
        stored_state = Room.model_validate_json(raw_redis_data)
        assert stored_state.room_id == room_id
        assert stored_state.host_id == user_id
        assert len(stored_state.participants) == 1
        assert stored_state.participants[0].username == "Alice_Tester"
        assert stored_state.participants[0].is_host is True
        assert stored_state.player.is_playing is False

        # Vérification du token hôte dans Redis
        stored_token = await redis_client.get(f"room:{room_id}:host_token")
        assert stored_token == host_token

        # Vérification du TTL dans Redis (> 0 et <= 7200s)
        ttl = await redis_client.ttl(f"room:{room_id}")
        assert 0 < ttl <= settings.ROOM_TTL_SECONDS

        # 3. Vérification via l'endpoint GET /api/v1/rooms/{room_id}
        check_response = await client.get(f"/api/v1/rooms/{room_id}")
        assert check_response.status_code == 200
        check_data = check_response.json()
        assert check_data["exists"] is True
        assert check_data["participant_count"] == 1

        # Nettoyage
        await redis_client.delete(f"room:{room_id}", f"room:{room_id}:host_token")


@pytest.mark.asyncio
async def test_delete_room_with_host_token(redis_client):
    """
    Test d'intégration : valide la destruction d'un salon via DELETE /api/v1/rooms/{room_id}
    avec le token d'administration secret de l'hôte.
    """
    async with (
        lifespan(app),
        AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client,
    ):
        # 1. Créer un salon
        create_resp = await client.post(
            "/api/v1/rooms", json={"username": "Host_Admin"}
        )
        assert create_resp.status_code == 201
        data = create_resp.json()
        room_id = data["room_id"]
        host_token = data["host_token"]

        # 2. Tentative de suppression sans token ou avec mauvais token -> 403
        bad_del = await client.delete(
            f"/api/v1/rooms/{room_id}",
            headers={"X-Host-Token": "wrong_token_123"},
        )
        assert bad_del.status_code == 403
        bad_del_json = bad_del.json()
        assert bad_del_json["error"]["code"] == "INVALID_HOST_TOKEN"
        assert "x-request-id" in bad_del.headers

        # 2b. Tentative de suppression d'un salon inexistant -> 404
        nf_del = await client.delete(
            "/api/v1/rooms/non_existent_room_999",
            headers={"X-Host-Token": "any_token"},
        )
        assert nf_del.status_code == 404
        assert nf_del.json()["error"]["code"] == "ROOM_NOT_FOUND"
        assert "x-request-id" in nf_del.headers

        # 3. Suppression avec le bon token -> 204 No Content
        good_del = await client.delete(
            f"/api/v1/rooms/{room_id}",
            headers={"X-Host-Token": host_token},
        )
        assert good_del.status_code == 204

        # 4. Vérification que le salon n'existe plus dans Redis
        assert await redis_client.exists(f"room:{room_id}") == 0
        assert await redis_client.exists(f"room:{room_id}:host_token") == 0

        # 5. Vérification que GET retourne exists: False
        get_resp = await client.get(f"/api/v1/rooms/{room_id}")
        assert get_resp.status_code == 200
        assert get_resp.json()["exists"] is False
