/**
 * Définitions de types partagées pour le lecteur multimédia et la synchronisation vidéo.
 */

/**
 * Statuts unifiés de la machine à états du lecteur multimédia.
 */
export type PlaybackStatus =
  | "idle"
  | "playing"
  | "paused"
  | "ended"
  | "buffering"
  | "error";

/**
 * Fournisseurs de contenu vidéo supportés.
 */
export type PlayerProvider = "youtube" | "twitch" | "vimeo" | "direct" | "unknown";
