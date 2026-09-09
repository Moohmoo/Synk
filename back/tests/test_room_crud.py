import pytest
import pytest_asyncio
from redis.asyncio import Redis

from core.config import settings
from domains.room.crud import RoomService


@pytest_asyncio.fixture
async def redis_client():
    client = Redis.from_url(settings.REDIS_URL, decode_responses=True)
    yield client
    await client.aclose()


@pytest.mark.asyncio
async def test_room_crud_lifecycle(redis_client):
    service = RoomService(redis_client)

    # 1. Création d'un salon
    room, host_token = await service.create_room("Alice")
    assert room.room_id is not None
    assert room.host_id is not None
    assert len(room.participants) == 1
    assert room.participants[0].username == "Alice"
    assert room.participants[0].is_host is True

    # Vérification du token hôte
    is_valid = await service.verify_host_token(room.room_id, host_token)
    assert is_valid is True

    # 2. Récupération du salon
    fetched_room = await service.get_room(room.room_id)
    assert fetched_room is not None
    assert fetched_room.room_id == room.room_id

    # 3. Ajout d'un participant
    updated_room, bob = await service.add_participant(room.room_id, "Bob")
    assert len(updated_room.participants) == 2
    assert bob.username == "Bob"
    assert bob.is_host is False

    # 4. Mise à jour de lecture
    player_room = await service.update_player(
        room.room_id, is_playing=True, current_time=25.0, media_id="test_vid_123"
    )
    assert player_room.player.is_playing is True
    assert player_room.player.current_time == 25.0
    assert player_room.player.media_id == "test_vid_123"

    # 5. Départ de l'hôte (Alice) -> transfert automatique d'hôte à Bob et régénération du token
    remaining_room, new_host, new_token = await service.remove_participant(
        room.room_id, room.host_id
    )
    assert len(remaining_room.participants) == 1
    assert remaining_room.participants[0].username == "Bob"
    assert remaining_room.participants[0].is_host is True
    assert new_host == bob.id
    assert new_token is not None
    # L'ancien token d'Alice doit être invalidé et le nouveau token de Bob doit être vérifié
    assert await service.verify_host_token(room.room_id, host_token) is False
    assert await service.verify_host_token(room.room_id, new_token) is True

    # 5.bis Alice tente de revenir avec son ancien token -> doit être simple invité
    is_valid_alice = await service.verify_host_token(room.room_id, host_token)
    assert is_valid_alice is False
    rejoined_room, alice_rejoined = await service.add_participant(
        room.room_id, "Alice", user_id="usr_alice_rejoin", is_host=is_valid_alice
    )
    assert alice_rejoined.is_host is False
    assert rejoined_room.host_id == bob.id
    current_bob = next(p for p in rejoined_room.participants if p.id == bob.id)
    assert current_bob.is_host is True

    # Nettoyage d'Alice pour la suite du test
    await service.remove_participant(room.room_id, alice_rejoined.id)

    # 6. Départ du dernier participant -> salon vide & pause automatique du lecteur
    empty_room, _, _ = await service.remove_participant(room.room_id, bob.id)
    assert len(empty_room.participants) == 0
    assert empty_room.player.is_playing is False

    # 7. Suppression du salon
    deleted = await service.delete_room(room.room_id)
    assert deleted is True
    assert await service.room_exists(room.room_id) is False


@pytest.mark.asyncio
async def test_duplicate_username_allowed(redis_client):
    service = RoomService(redis_client)

    # 1. Création avec "Alex"
    room, _host_token = await service.create_room("Alex")
    assert len(room.participants) == 1
    assert room.participants[0].username == "Alex"
    host_id = room.host_id

    # 2. Un 2ème utilisateur rejoint avec "Alex" (autorisé, distingué par son ID unique)
    room, alex2 = await service.add_participant(room.room_id, "Alex")
    assert alex2.username == "Alex"
    assert alex2.id != host_id
    assert len(room.participants) == 2

    # 3. Un 3ème utilisateur rejoint avec "alex" (autorisé également)
    room, alex3 = await service.add_participant(room.room_id, "alex")
    assert alex3.username == "alex"
    assert alex3.id != alex2.id
    assert alex3.id != host_id
    assert len(room.participants) == 3

    # 4. Reconnexion d'Alex (2ème participant) avec son user_id existant (F5) -> conserve ses données
    room, alex2_reconnected = await service.add_participant(
        room.room_id, "Alex", user_id=alex2.id
    )
    assert alex2_reconnected.id == alex2.id
    assert alex2_reconnected.username == "Alex"
    assert len(room.participants) == 3

    # Nettoyage
    await service.delete_room(room.room_id)


@pytest.mark.asyncio
async def test_update_player_safe_idempotence(redis_client):
    service = RoomService(redis_client)
    room, _ = await service.create_room("HostUser")
    host = room.participants[0]

    # 1. Le salon est initialement en pause (is_playing=False)
    assert room.player.is_playing is False

    # 2. Envoi d'une PAUSE alors que le salon est déjà en pause -> NOOP idempotent
    res_room, err = await service.update_player_safe(
        room.room_id, host, is_playing=False, current_time=10.0
    )
    assert err == "NOOP"
    assert res_room is not None

    # 3. Lancement de la lecture (is_playing=True) -> Mise à jour effective
    play_room, err = await service.update_player_safe(
        room.room_id, host, is_playing=True, current_time=10.0
    )
    assert err is None
    assert play_room.player.is_playing is True

    # 4. Envoi d'un PLAY alors que le salon est déjà en lecture -> NOOP idempotent
    _noop_play_room, err = await service.update_player_safe(
        room.room_id, host, is_playing=True, current_time=15.0
    )
    assert err == "NOOP"

    # 4b. Replay : envoi d'un PLAY à 0.0s alors que le salon est en cours de lecture -> Replay effectif
    replay_room, err = await service.update_player_safe(
        room.room_id, host, is_playing=True, current_time=0.0
    )
    assert err is None
    assert replay_room.player.current_time == 0.0
    assert replay_room.player.is_playing is True

    # 5. SEEK (is_playing est None) -> Doit s'exécuter normalement
    seek_room, err = await service.update_player_safe(
        room.room_id, host, current_time=55.0
    )
    assert err is None
    assert seek_room.player.current_time == 55.0
    assert seek_room.player.is_playing is True

    # 6. Rembobinage en pause : si la vidéo est en pause à 0s, un seek à 0s -> NOOP
    pause_room, _ = await service.update_player_safe(
        room.room_id, host, is_playing=False, current_time=0.0
    )
    assert pause_room.player.is_playing is False
    assert pause_room.player.current_time == 0.0

    _noop_seek, err = await service.update_player_safe(
        room.room_id, host, current_time=0.0
    )
    assert err == "NOOP"

    # Nettoyage
    await service.delete_room(room.room_id)


@pytest.mark.asyncio
async def test_update_settings_safe_idempotence(redis_client):
    service = RoomService(redis_client)
    room, _ = await service.create_room("HostUser")
    host = room.participants[0]

    # Initialement non verrouillé
    assert room.settings.is_locked is False

    # 1. Tenter de déverrouiller un salon déjà déverrouillé -> NOOP idempotent
    _res_room, err = await service.update_settings_safe(
        room.room_id, host, is_locked=False
    )
    assert err == "NOOP"

    # 2. Verrouiller le salon -> Modification effective
    locked_room, err = await service.update_settings_safe(
        room.room_id, host, is_locked=True
    )
    assert err is None
    assert locked_room.settings.is_locked is True

    # 3. Tenter de re-verrouiller le salon -> NOOP idempotent
    _noop_room, err = await service.update_settings_safe(
        room.room_id, host, is_locked=True
    )
    assert err == "NOOP"

    # Nettoyage
    await service.delete_room(room.room_id)


@pytest.mark.asyncio
async def test_room_unclaimed_ttl_and_claim_extension(redis_client):
    """Valide le TTL initial court (300s) et son extension lors de la réclamation du salon."""
    service = RoomService(redis_client)
    room, _ = await service.create_room("HostAlice")

    # Initialement créé : TTL non réclamé (300s)
    ttl_initial = await redis_client.ttl(f"room:{room.room_id}")
    assert 0 < ttl_initial <= settings.ROOM_UNCLAIMED_TTL_SECONDS

    # Premier participant rejoint : TTL étendu au cycle de vie normal (7200s)
    await service.add_participant(room.room_id, "HostAlice", user_id=room.host_id)
    ttl_claimed = await redis_client.ttl(f"room:{room.room_id}")
    assert ttl_claimed > settings.ROOM_UNCLAIMED_TTL_SECONDS
    assert ttl_claimed <= settings.ROOM_TTL_SECONDS

    await service.delete_room(room.room_id)


@pytest.mark.asyncio
async def test_room_max_participants_limit(redis_client):
    """Valide le rejet de nouveaux participants lorsque le plafond du salon est atteint."""
    service = RoomService(redis_client)
    room, _ = await service.create_room("HostUser")
    host_id = room.host_id

    # Remplissage jusqu'à la limite maximale
    for i in range(1, settings.MAX_PARTICIPANTS_PER_ROOM):
        await service.add_participant(room.room_id, f"User_{i}")

    # Participant supplémentaire au-delà du plafond : rejeté
    overflow = await service.add_participant(room.room_id, "User_Overflow")
    assert overflow is None

    # Reconnexion d'un participant existant : autorisée
    reconnect = await service.add_participant(room.room_id, "HostUser", user_id=host_id)
    assert reconnect is not None

    await service.delete_room(room.room_id)

