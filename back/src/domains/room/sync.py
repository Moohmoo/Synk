import time
from dataclasses import dataclass
from enum import Enum

from domains.room.schemas.room import PlayerState


class SyncAction(str, Enum):
    """Actions de synchronisation calculées pour la compensation du drift."""

    IN_SYNC = "IN_SYNC"  # Décalage < 200ms : lecture fluide
    ADJUST_SPEED = (
        "ADJUST_SPEED"  # 200ms <= Décalage <= 1.5s : micro-ajustement x0.95 ou x1.05
    )
    SEEK = "SEEK"  # Décalage > 1.5s : saut direct (seek) sans transition


@dataclass(frozen=True)
class SyncEvaluation:
    """Résultat de l'évaluation de synchronisation pour un client."""

    action: SyncAction
    drift_seconds: float
    reference_time: float
    client_time: float
    playback_rate: float = 1.0
    target_seek_time: float | None = None


class SyncService:
    """
    Service algorithmique pur de compensation temporelle (Drift Compensation).
    Intègre la compensation du transit réseau (Ping / 2 RTT) pour une précision mondiale.
    Découplé du transport et de la base de données (déterministe et testable).
    """

    # Seuils de synchronisation en secondes (conformes aux tech specs)
    PERFECT_ZONE_THRESHOLD_SEC: float = 0.200  # 200 ms
    MICRO_DRIFT_THRESHOLD_SEC: float = 1.500  # 1500 ms (1.5s)

    SPEED_CATCH_UP: float = 1.05  # Accélération pour rattraper le retard
    SPEED_SLOW_DOWN: float = 0.95  # Ralentissement si le client est en avance

    @classmethod
    def calculate_reference_position(
        cls,
        player: PlayerState,
        now_ms: int | None = None,
        playback_rate: float = 1.0,
    ) -> float:
        """
        Calcule la position théorique exacte de référence de la vidéo à l'instant T.
        Formule : Position Référence = current_time + (now_ms - last_updated_at) / 1000 * vitesse
        """
        if not player.is_playing:
            return round(player.current_time, 3)

        current_timestamp = now_ms if now_ms is not None else int(time.time() * 1000)
        elapsed_sec = max(0.0, (current_timestamp - player.last_updated_at) / 1000.0)

        return round(player.current_time + (elapsed_sec * playback_rate), 3)

    @classmethod
    def evaluate_drift(
        cls,
        player: PlayerState,
        client_time: float = 0.0,
        ping_ms: int = 0,
        now_ms: int | None = None,
    ) -> SyncEvaluation:
        """
        Évalue l'écart (drift) entre la position d'un client et la position théorique de référence,
        en compensant la latence de transit réseau (RTT / 2).

        Applique la stratégie à 3 seuils :
        - Zone Parfaite (Δt < 200ms) : IN_SYNC (vitesse = 1.0)
        - Micro-Décalage (200ms <= Δt <= 1.5s) : ADJUST_SPEED (vitesse 0.95 ou 1.05)
        - Désynchronisation (Δt > 1.5s) : SEEK direct vers la position de référence
        """
        # Le temps que le message voyage sur le réseau, la vidéo du client a avancé (si en lecture)
        transit_time_sec = (ping_ms / 2.0) / 1000.0 if player.is_playing else 0.0
        actual_client_time = round(client_time + transit_time_sec, 3)

        ref_time = cls.calculate_reference_position(player, now_ms=now_ms)
        drift = abs(actual_client_time - ref_time)

        # 1. Zone Parfaite (< 200 ms)
        if drift < cls.PERFECT_ZONE_THRESHOLD_SEC:
            return SyncEvaluation(
                action=SyncAction.IN_SYNC,
                drift_seconds=round(drift, 4),
                reference_time=ref_time,
                client_time=actual_client_time,
                playback_rate=1.0,
            )

        # 2. Micro-Décalage (200 ms à 1500 ms)
        if drift <= cls.MICRO_DRIFT_THRESHOLD_SEC:
            # Si le client est en retard (actual_client_time < ref_time), on accélère à 1.05
            # Si le client est en avance (actual_client_time > ref_time), on ralentit à 0.95
            rate = (
                cls.SPEED_CATCH_UP
                if actual_client_time < ref_time
                else cls.SPEED_SLOW_DOWN
            )
            return SyncEvaluation(
                action=SyncAction.ADJUST_SPEED,
                drift_seconds=round(drift, 4),
                reference_time=ref_time,
                client_time=actual_client_time,
                playback_rate=rate,
            )

        # 3. Désynchronisation Majeure (> 1500 ms)
        return SyncEvaluation(
            action=SyncAction.SEEK,
            drift_seconds=round(drift, 4),
            reference_time=ref_time,
            client_time=actual_client_time,
            playback_rate=1.0,
            target_seek_time=ref_time,
        )
