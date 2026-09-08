import { useState, useEffect, useRef } from "react";
import { PlayerState } from "@/types/room";

interface UseInterpolatedTimeOptions {
  player: PlayerState;
  duration?: number;
  isScrubbing?: boolean;
}

/**
 * Hook d'estime locale (Dead Reckoning) pour le lecteur multimédia.
 * Calcule en continu la position temporelle extrapolée sans requêtes réseau.
 *
 * Formule :
 * temps_courant = is_playing ? (current_time + (now - last_updated_at)) : current_time
 */
export function useInterpolatedTime({
  player,
  duration = 0,
  isScrubbing = false,
}: UseInterpolatedTimeOptions): number {
  const [interpolatedTime, setInterpolatedTime] = useState<number>(player.current_time);
  const playerRef = useRef(player);
  playerRef.current = player;

  // Réinitialisation immédiate lors des synchronisations réseau (Play, Pause, Seek, Sync)
  useEffect(() => {
    setInterpolatedTime(player.current_time);
  }, [player.current_time, player.last_updated_at, player.is_playing]);

  useEffect(() => {
    // Si la vidéo est en pause ou si l'utilisateur manipule le curseur, pas d'interpolation
    if (!player.is_playing || isScrubbing) {
      return;
    }

    const tick = () => {
      const now = Date.now();
      const elapsedSeconds = Math.max(0, (now - playerRef.current.last_updated_at) / 1000);
      const computed = playerRef.current.current_time + elapsedSeconds;

      // Clamper à la durée maximale pour ne pas dépasser la fin de la vidéo
      const max = duration > 0 ? duration : computed;
      setInterpolatedTime(Math.min(computed, max));
    };

    // Calcul immédiat au déclenchement
    tick();

    // Rafraîchissement régulier (250ms = 4 ticks/sec pour un défilement précis et économe en CPU)
    const intervalId = setInterval(tick, 250);

    return () => clearInterval(intervalId);
  }, [player.is_playing, player.current_time, player.last_updated_at, duration, isScrubbing]);

  return interpolatedTime;
}
