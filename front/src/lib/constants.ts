/**
 * Constantes de synchronisation et de tolérance pour le lecteur de salon.
 */

/**
 * Seuil de dérive temporelle toléré (en secondes) avant de considérer
 * qu'un participant a un décalage de lecture notable par rapport au salon.
 *
 * 2.0 secondes absorbe le re-buffering et le jitter réseau naturel
 * tout en évitant les spoilers lors du visionnage partagé.
 */
export const DESYNC_THRESHOLD_SECONDS = 2.0;

/**
 * Seuil en secondes avant la durée totale pour considérer que la fin du média est atteinte (300ms).
 */
export const END_THRESHOLD_SECONDS = 0.3;

/**
 * Tolérance en secondes de décalage avant d'ajuster impérativement la position du DOM vidéo.
 */
export const DOM_SYNC_DRIFT_THRESHOLD_SECONDS = 0.5;

/**
 * URL du dépôt GitHub du projet.
 */
export const GITHUB_REPO_URL =
  import.meta.env.VITE_GITHUB_URL || "https://github.com/Moohmoo/Synk";
