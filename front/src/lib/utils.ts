import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Formate un nombre de secondes en format lisible (MM:SS ou HH:MM:SS).
 */
export function formatTime(seconds: number): string {
  if (!seconds || isNaN(seconds) || seconds < 0) return "0:00";
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const padSecs = String(secs).padStart(2, "0");
  if (hrs > 0) return `${hrs}:${String(mins).padStart(2, "0")}:${padSecs}`;
  return `${mins}:${padSecs}`;
}

/**
 * Calcule la position théorique exacte du média à l'instant T
 * en tenant compte du temps écoulé depuis la dernière mise à jour.
 */
export function calculateReferenceTime(player: {
  is_playing: boolean;
  current_time: number;
  last_updated_at: number;
  duration?: number;
}): number {
  if (!player.is_playing) return Math.max(0, player.current_time);
  const elapsed = Math.max(0, (Date.now() - player.last_updated_at) / 1000);
  const target = player.current_time + elapsed;
  return player.duration && player.duration > 0 ? Math.min(target, player.duration) : target;
}
