import time

from domains.room.schemas.room import PlayerState
from domains.room.sync import calculate_reference_position


def test_calculate_reference_position_paused():
    """Si la vidéo est en pause, la position reste inchangée."""
    player = PlayerState(
        is_playing=False,
        current_time=42.0,
        last_updated_at=int(time.time() * 1000) - 5000,
    )
    assert calculate_reference_position(player) == 42.0


def test_calculate_reference_position_playing():
    """Si la vidéo est en lecture, la position avance avec le temps écoulé."""
    now_ms = 1772450120000
    player = PlayerState(
        is_playing=True,
        current_time=10.0,
        last_updated_at=now_ms - 5000,  # 5 secondes écoulées
    )
    assert calculate_reference_position(player, now_ms=now_ms) == 15.0


def test_calculate_reference_position_with_playback_rate():
    """La vitesse de lecture influence la progression calculée."""
    now_ms = 1772450120000
    player = PlayerState(
        is_playing=True,
        current_time=10.0,
        last_updated_at=now_ms - 4000,  # 4 secondes écoulées à 1.5x = +6s
    )
    assert (
        calculate_reference_position(player, now_ms=now_ms, playback_rate=1.5) == 16.0
    )


def test_calculate_reference_position_clock_skew_resilient():
    """Si l'horloge système recule, la position ne peut pas devenir inférieure."""
    now_ms = 1772450120000
    player = PlayerState(
        is_playing=True,
        current_time=25.0,
        last_updated_at=now_ms + 2000,  # Horloge dans le futur
    )
    assert calculate_reference_position(player, now_ms=now_ms) == 25.0
def test_calculate_reference_position_capped_at_duration():
    """La position calculée ne dépasse jamais la durée totale si elle est définie."""
    now_ms = 1772450120000
    player = PlayerState(
        is_playing=True,
        current_time=10.0,
        duration=60.0,
        last_updated_at=now_ms - 100000,  # 100 secondes écoulées
    )
    assert calculate_reference_position(player, now_ms=now_ms) == 60.0


