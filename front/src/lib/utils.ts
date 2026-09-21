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
 *
 * Le paramètre `serverTimeOffsetMs` applique la compensation d'horloge (formule SNTP / RFC 4330)
 * pour éviter tout décalage d'extrapolation si l'ordinateur du client a une horloge déréglée (Clock Skew).
 */
export function calculateReferenceTime(
  player: {
    is_playing: boolean;
    current_time: number;
    last_updated_at: number;
    duration?: number;
  },
  serverTimeOffsetMs: number = 0
): number {
  if (!player.is_playing) return Math.max(0, player.current_time);
  const nowServer = Date.now() + serverTimeOffsetMs;
  const elapsed = Math.max(0, (nowServer - player.last_updated_at) / 1000);
  const target = player.current_time + elapsed;
  return player.duration && player.duration > 0 ? Math.min(target, player.duration) : target;
}

/**
 * Extrait l'identifiant unique du salon depuis une chaîne brute ou une URL complète.
 * (ex: "code123", "https://synk.app/room/code123?join=true" -> "code123")
 */
export function extractRoomCode(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.includes("/room/")) {
    return trimmed.split("/room/").pop()?.split("?")[0].split("#")[0] || "";
  }
  return trimmed;
}

export interface AvatarPalette {
  bg: string;
  text: string;
  border: string;
}

export const AVATAR_COLOR_PALETTES: AvatarPalette[] = [
  { bg: "bg-primary/15", text: "text-primary", border: "border-primary/30" },
  { bg: "bg-violet-500/15", text: "text-violet-400", border: "border-violet-500/30" },
  { bg: "bg-emerald-500/15", text: "text-emerald-400", border: "border-emerald-500/30" },
  { bg: "bg-amber-500/15", text: "text-amber-400", border: "border-amber-500/30" },
  { bg: "bg-rose-500/15", text: "text-rose-400", border: "border-rose-500/30" },
  { bg: "bg-blue-500/15", text: "text-blue-400", border: "border-blue-500/30" },
  { bg: "bg-fuchsia-500/15", text: "text-fuchsia-400", border: "border-fuchsia-500/30" },
  { bg: "bg-indigo-500/15", text: "text-indigo-400", border: "border-indigo-500/30" },
];

/**
 * Calcule une palette de couleurs déterministe à partir d'un identifiant
 * pour différencier visuellement les participants.
 */
export function getParticipantColor(id: string): AvatarPalette {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash << 5) - hash + id.charCodeAt(i);
    hash |= 0;
  }
  const index = Math.abs(hash) % AVATAR_COLOR_PALETTES.length;
  return AVATAR_COLOR_PALETTES[index];
}
