import time

from domains.room.schemas.room import PlayerState
from domains.room.sync import SyncAction, SyncService


def test_calculate_reference_position_paused():
    player = PlayerState(
        is_playing=False,
        current_time=42.0,
        last_updated_at=int(time.time() * 1000) - 5000,
    )
    # Si la vidéo est en pause, la position ne doit pas bouger
    ref = SyncService.calculate_reference_position(player)
    assert ref == 42.0


def test_calculate_reference_position_playing():
    now_ms = 1772450120000
    player = PlayerState(
        is_playing=True,
        current_time=10.0,
        last_updated_at=now_ms - 5000,  # 5 secondes écoulées
    )
    ref = SyncService.calculate_reference_position(player, now_ms=now_ms)
    assert ref == 15.0


def test_evaluate_drift_in_sync():
    now_ms = 1772450120000
    player = PlayerState(
        is_playing=True,
        current_time=10.0,
        last_updated_at=now_ms,
    )
    # Décalage de 50 ms (< 200 ms)
    res = SyncService.evaluate_drift(player, client_time=10.05, now_ms=now_ms)
    assert res.action == SyncAction.IN_SYNC
    assert res.playback_rate == 1.0


def test_evaluate_drift_adjust_speed_slow_down():
    now_ms = 1772450120000
    player = PlayerState(
        is_playing=True,
        current_time=10.0,
        last_updated_at=now_ms,
    )
    # Client en avance de 500 ms (10.5s au lieu de 10.0s) -> doit ralentir (0.95)
    res = SyncService.evaluate_drift(player, client_time=10.50, now_ms=now_ms)
    assert res.action == SyncAction.ADJUST_SPEED
    assert res.playback_rate == 0.95


def test_evaluate_drift_adjust_speed_catch_up():
    now_ms = 1772450120000
    player = PlayerState(
        is_playing=True,
        current_time=10.0,
        last_updated_at=now_ms,
    )
    # Client en retard de 500 ms (9.5s au lieu de 10.0s) -> doit accélérer (1.05)
    res = SyncService.evaluate_drift(player, client_time=9.50, now_ms=now_ms)
    assert res.action == SyncAction.ADJUST_SPEED
    assert res.playback_rate == 1.05


def test_evaluate_drift_seek():
    now_ms = 1772450120000
    player = PlayerState(
        is_playing=True,
        current_time=10.0,
        last_updated_at=now_ms,
    )
    # Décalage majeur de 3.0s (> 1.5s) -> saut direct (SEEK)
    res = SyncService.evaluate_drift(player, client_time=13.0, now_ms=now_ms)
    assert res.action == SyncAction.SEEK
    assert res.target_seek_time == 10.0


def test_evaluate_drift_with_high_ping_transit_compensation():
    now_ms = 1772450120000
    player = PlayerState(
        is_playing=True,
        current_time=10.0,
        last_updated_at=now_ms,
    )
    # Le serveur évalue à ref_time = 10.0
    # Le client envoie 9.90s, mais a un ping RTT de 200 ms (transit = 100 ms)
    # actual_client_time = 9.90 + 0.100 = 10.0s -> Parfaitement IN_SYNC !
    res = SyncService.evaluate_drift(
        player, client_time=9.90, ping_ms=200, now_ms=now_ms
    )
    assert res.action == SyncAction.IN_SYNC
    assert res.client_time == 10.0
    assert res.drift_seconds == 0.0
