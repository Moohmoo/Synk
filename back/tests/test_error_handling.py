import pytest
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient
from pydantic import BaseModel, Field

from core.error_handlers import register_exception_handlers
from core.exceptions import (
    InvalidHostTokenError,
    RoomLockedError,
    RoomNotFoundError,
)


class SamplePayload(BaseModel):
    username: str = Field(..., min_length=2, max_length=20)


@pytest.fixture
def app_with_test_routes():
    test_app = FastAPI()
    register_exception_handlers(test_app)

    @test_app.post("/trigger-validation")
    async def route_validation(payload: SamplePayload):
        return {"status": "ok"}

    @test_app.get("/trigger-not-found")
    async def route_not_found():
        raise RoomNotFoundError("room_secret_999")

    @test_app.get("/trigger-forbidden")
    async def route_forbidden():
        raise InvalidHostTokenError("Internal: secret token abc does not match xyz")

    @test_app.get("/trigger-locked")
    async def route_locked():
        raise RoomLockedError()

    @test_app.get("/trigger-crash")
    async def route_crash():
        # Simule un crash inattendu (division par zéro, DB crash)
        return 1 / 0

    return test_app


@pytest.mark.asyncio
async def test_domain_error_sanitization_and_request_id(app_with_test_routes):
    """Vérifie que les erreurs du domaine masquent les détails internes et incluent un request_id."""
    async with AsyncClient(
        transport=ASGITransport(app=app_with_test_routes), base_url="http://test"
    ) as client:
        # 1. Test 404 RoomNotFoundError
        res_404 = await client.get("/trigger-not-found")
        assert res_404.status_code == 404
        data_404 = res_404.json()
        assert data_404["error"]["code"] == "ROOM_NOT_FOUND"
        assert "Ce salon n'existe pas" in data_404["error"]["message"]
        # Assure que les détails internes (ex: room_secret_999) ne fuitent pas
        assert "room_secret_999" not in data_404["error"]["message"]
        assert "request_id" in data_404["error"]
        assert "x-request-id" in res_404.headers

        # 2. Test 403 InvalidHostTokenError
        res_403 = await client.get("/trigger-forbidden")
        assert res_403.status_code == 403
        data_403 = res_403.json()
        assert data_403["error"]["code"] == "INVALID_HOST_TOKEN"
        assert "secret token abc" not in data_403["error"]["message"]
        assert "request_id" in data_403["error"]

        # 3. Test 423 RoomLockedError
        res_423 = await client.get("/trigger-locked")
        assert res_423.status_code == 423
        assert res_423.json()["error"]["code"] == "ROOM_LOCKED"


@pytest.mark.asyncio
async def test_unhandled_crash_masks_traceback(app_with_test_routes):
    """Vérifie qu'un crash inattendu (500) ne fuite JAMAIS le traceback ou les fichiers Python."""
    async with AsyncClient(
        transport=ASGITransport(app=app_with_test_routes, raise_app_exceptions=False),
        base_url="http://test",
    ) as client:
        res_500 = await client.get("/trigger-crash")
        assert res_500.status_code == 500
        data_500 = res_500.json()

        # Le client reçoit un message générique poli
        assert data_500["error"]["code"] == "INTERNAL_SERVER_ERROR"
        assert "Une erreur inattendue est survenue" in data_500["error"]["message"]
        assert "request_id" in data_500["error"]

        # ZÉRO fuite de traceback ou de code Python
        raw_body = res_500.text
        assert "ZeroDivisionError" not in raw_body
        assert "Traceback" not in raw_body
        assert ".py" not in raw_body


@pytest.mark.asyncio
async def test_validation_error_handler(app_with_test_routes):
    """Vérifie que le handler 422 formate proprement les erreurs de validation avec field_errors et request_id."""
    async with AsyncClient(
        transport=ASGITransport(app=app_with_test_routes), base_url="http://test"
    ) as client:
        res = await client.post("/trigger-validation", json={"username": "a"})
        assert res.status_code == 422
        data = res.json()

        assert data["error"]["code"] == "VALIDATION_ERROR"
        assert "username" in data["error"]["field_errors"]
        assert "request_id" in data["error"]
        assert "x-request-id" in res.headers
        assert isinstance(data["detail"], list)
