"""Calcul de la position de référence temporelle pour la synchronisation vidéo."""

import time

from domains.room.schemas.room import PlayerState


def calculate_reference_position(
    player: PlayerState,
    now_ms: int | None = None,
    playback_rate: float = 1.0,
) -> float:
    """
    Calcule la position théorique exacte de la vidéo à l'instant T.

    Formule : Position = current_time + (temps_actuel - last_updated_at) * vitesse
    """
    if not player.is_playing:
        return round(player.current_time, 3)

    now = now_ms if now_ms is not None else int(time.time() * 1000)
    elapsed_sec = max(0.0, (now - player.last_updated_at) / 1000.0)
    target = player.current_time + (elapsed_sec * playback_rate)

    if player.duration and player.duration > 0:
        target = min(target, player.duration)

    return round(target, 3)
