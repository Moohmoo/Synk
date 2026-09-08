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
