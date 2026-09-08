import pytest
import pytest_asyncio

from db.database import DatabaseService
from db.manager import DatabaseManager
from domains.room.index import (
    InvalidHostTokenError,
    RoomNotFoundError,
    check_room,
    create_room,
    delete_room,
)


@pytest_asyncio.fixture
async def setup_redis():
    await DatabaseService.init_databases()
    yield
    await DatabaseService.close_databases()


@pytest.mark.asyncio
@pytest.mark.usefixtures("setup_redis")
async def test_database_manager_context():
    """Valide que DatabaseManager initialise bien room_service sur la session."""
    with DatabaseManager() as db:
        assert db.redis is not None
        assert db.room_service is not None
        assert hasattr(db.room_service, "create_room")


@pytest.mark.asyncio
@pytest.mark.usefixtures("setup_redis")
async def test_room_index_full_lifecycle():
    """Valide le cycle de vie métier (create -> check -> delete) via domains.room.index."""
    # 1. Création du salon
    room, token = await create_room("Host_Tester")
    assert room.room_id is not None
    assert token.startswith("tok_sec_")

    # 2. Vérification du salon
    exists, count = await check_room(room.room_id)
    assert exists is True
    assert count == 1

    # 3. Tentative de suppression avec un mauvais token -> InvalidHostTokenError
    with pytest.raises(InvalidHostTokenError):
        await delete_room(room.room_id, "wrong_token_xyz")

    # 4. Suppression avec le bon token
    await delete_room(room.room_id, token)

    # 5. Vérification que le salon n'existe plus
    exists_after, _ = await check_room(room.room_id)
    assert exists_after is False

    # 6. Tentative de suppression d'un salon inexistant -> RoomNotFoundError
    with pytest.raises(RoomNotFoundError):
        await delete_room(room.room_id, token)
