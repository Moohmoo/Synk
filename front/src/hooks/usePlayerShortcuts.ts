import { useEffect } from "react";
import { PlayerController } from "@/hooks/usePlayer";

export interface UsePlayerShortcutsOptions {
  controller: PlayerController;
  toggleFullscreen: () => void;
  isFullscreen: boolean;
  resetControlsTimeout: () => void;
  onChangeMedia?: () => void;
}

/**
 * Détecte si l'élément actuellement ciblé est un champ de saisie utilisateur
 * (évite de déclencher les raccourcis du lecteur lors de la frappe dans le chat ou un dialogue).
 */
function isInteractiveInput(target: EventTarget | null): boolean {
  if (!target || !(target instanceof HTMLElement)) return false;
  const tag = target.tagName.toLowerCase();
  return (
    tag === "input" ||
    tag === "textarea" ||
    tag === "select" ||
    target.isContentEditable
  );
}

/**
 * Hook de gestion des raccourcis clavier globaux du lecteur vidéo :
 * - Espace / K : Lecture / Pause
 * - F : Plein écran
 * - M : Sourdine (Mute / Unmute)
 * - Flèches Haut / Bas : Volume +/- 5%
 * - Flèches Gauche / Droite : Saut +/- 5s
 * - C : Sous-titres (Captions)
 * - S : Rattrapage du flux salon (Sync / Catch-up)
 * - Cmd+K / Ctrl+K : Boîte de dialogue de changement de média
 * - Échap : Sortie du plein écran
 */
export function usePlayerShortcuts({
  controller,
  toggleFullscreen,
  isFullscreen,
  resetControlsTimeout,
  onChangeMedia,
}: UsePlayerShortcutsOptions): void {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignorer si le focus est sur un champ de saisie
      if (isInteractiveInput(e.target)) return;

      // Cmd+K ou Ctrl+K : changement de média
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        onChangeMedia?.();
        return;
      }

      // Ignorer si d'autres modificateurs sont maintenus
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      switch (e.key) {
        // Lecture / Pause
        case " ":
        case "k":
        case "K":
          e.preventDefault();
          if (!controller.isPlayDisabled) {
            controller.togglePlay();
            resetControlsTimeout();
          }
          break;

        // Plein écran
        case "f":
        case "F":
          e.preventDefault();
          toggleFullscreen();
          break;

        // Mute / Unmute
        case "m":
        case "M":
          e.preventDefault();
          controller.toggleMute();
          resetControlsTimeout();
          break;

        // Volume +5%
        case "ArrowUp":
          e.preventDefault();
          controller.setVolume(Math.min(100, controller.volume + 5));
          resetControlsTimeout();
          break;

        // Volume -5%
        case "ArrowDown":
          e.preventDefault();
          controller.setVolume(Math.max(0, controller.volume - 5));
          resetControlsTimeout();
          break;

        // Reculer de 5s
        case "ArrowLeft":
          e.preventDefault();
          if (!controller.isSeekDisabled) {
            const target = Math.max(0, controller.currentTime - 5);
            controller.seek(target);
            resetControlsTimeout();
          }
          break;

        // Avancer de 5s
        case "ArrowRight":
          e.preventDefault();
          if (!controller.isSeekDisabled) {
            const maxDuration =
              controller.duration > 0 ? controller.duration : controller.currentTime + 5;
            const target = Math.min(maxDuration, controller.currentTime + 5);
            controller.seek(target);
            resetControlsTimeout();
          }
          break;

        // Sous-titres (Captions)
        case "c":
        case "C":
          e.preventDefault();
          controller.toggleSubtitles();
          resetControlsTimeout();
          break;

        // Rattraper le salon (Sync / Catch-up)
        case "s":
        case "S":
          if (controller.isBehind && !controller.isSeekDisabled) {
            e.preventDefault();
            controller.catchUp();
            resetControlsTimeout();
          }
          break;

        // Sortir du plein écran avec Échap
        case "Escape":
          if (isFullscreen) {
            e.preventDefault();
            toggleFullscreen();
          }
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    controller,
    isFullscreen,
    onChangeMedia,
    toggleFullscreen,
    resetControlsTimeout,
  ]);
}

export default usePlayerShortcuts;
