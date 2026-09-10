import { useState, useEffect, useRef, useCallback } from "react";
import { PlayerController } from "@/hooks/usePlayerController";

export interface UseCinemaModeOptions {
  containerRef: React.RefObject<HTMLElement>;
  controller: PlayerController;
  volume: number;
  isMuted: boolean;
  onVolumeChange: (volume: number) => void;
  onToggleMute: () => void;
  onChangeMedia?: () => void;
}

export interface CinemaModeState {
  isFullscreen: boolean;
  areControlsVisible: boolean;
  toggleFullscreen: () => void;
  resetControlsTimeout: () => void;
}

/**
 * Détecte si l'élément actuellement ciblé est un champ de saisie utilisateur
 * (évite de déclencher les raccourcis du lecteur lors de la frappe dans le chat ou l'omnibox).
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
 * Hook d'ergonomie cinéma unifié :
 * - Gestion du plein écran (API native W3C + WebKit Safari + repli In-Window CSS).
 * - Minuteur d'auto-hide des contrôles (3s en cours de lecture).
 * - Raccourcis clavier universels (Espace, F, M, Flèches, C/S, Cmd+K, Échap).
 */
export function useCinemaMode({
  containerRef,
  controller,
  volume,
  isMuted,
  onVolumeChange,
  onToggleMute,
  onChangeMedia,
}: UseCinemaModeOptions): CinemaModeState {
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [areControlsVisible, setAreControlsVisible] = useState<boolean>(true);
  const controlsTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Réinitialise le minuteur d'inactivité des contrôles
  const resetControlsTimeout = useCallback(() => {
    setAreControlsVisible(true);
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }
    if (controller.status === "playing") {
      controlsTimeoutRef.current = setTimeout(() => {
        setAreControlsVisible(false);
      }, 3000);
    }
  }, [controller.status]);

  // Si la vidéo n'est plus en lecture, les contrôles restent toujours visibles
  useEffect(() => {
    if (controller.status !== "playing") {
      setAreControlsVisible(true);
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
      }
    } else if (isFullscreen) {
      resetControlsTimeout();
    }
  }, [controller.status, isFullscreen, resetControlsTimeout]);

  // Nettoyage du timer au démontage
  useEffect(() => {
    return () => {
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
      }
    };
  }, []);

  // Bloque le défilement de la page arrière-plan lors du plein écran In-Window CSS
  useEffect(() => {
    if (isFullscreen) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [isFullscreen]);

  // Bascule plein écran robuste : support API W3C, WebKit Safari et repli In-Window CSS
  const toggleFullscreen = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;

    const doc = document as Document & {
      webkitFullscreenElement?: Element;
      webkitExitFullscreen?: () => Promise<void>;
    };
    const isNativeActive = Boolean(doc.fullscreenElement || doc.webkitFullscreenElement);

    if (isFullscreen || isNativeActive) {
      if (isNativeActive) {
        const exit = doc.exitFullscreen || doc.webkitExitFullscreen;
        exit?.call(doc).catch(() => {});
      }
      setIsFullscreen(false);
      setAreControlsVisible(true);
    } else {
      const req =
        container.requestFullscreen ||
        (container as unknown as { webkitRequestFullscreen?: () => Promise<void> })
          .webkitRequestFullscreen;

      if (typeof req === "function") {
        req
          .call(container)
          .then(() => setIsFullscreen(true))
          .catch(() => setIsFullscreen(true));
      } else {
        // iPhone Safari : repli immédiat In-Window CSS
        setIsFullscreen(true);
      }
      resetControlsTimeout();
    }
  }, [isFullscreen, containerRef, resetControlsTimeout]);

  // Écouteur des changements natifs de plein écran (ex: touche Échap gérée par le navigateur)
  useEffect(() => {
    const handleNativeChange = () => {
      const doc = document as Document & {
        webkitFullscreenElement?: Element;
      };
      const isNative = Boolean(doc.fullscreenElement || doc.webkitFullscreenElement);
      setIsFullscreen(isNative);
      if (!isNative) {
        setAreControlsVisible(true);
      }
    };

    document.addEventListener("fullscreenchange", handleNativeChange);
    document.addEventListener("webkitfullscreenchange", handleNativeChange);

    return () => {
      document.removeEventListener("fullscreenchange", handleNativeChange);
      document.removeEventListener("webkitfullscreenchange", handleNativeChange);
    };
  }, []);

  // Raccourcis clavier universels
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignorer si le focus est sur un champ de texte
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
          onToggleMute();
          resetControlsTimeout();
          break;

        // Volume +5%
        case "ArrowUp":
          e.preventDefault();
          onVolumeChange(Math.min(100, volume + 5));
          resetControlsTimeout();
          break;

        // Volume -5%
        case "ArrowDown":
          e.preventDefault();
          onVolumeChange(Math.max(0, volume - 5));
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

        // Rattraper le salon (Catch-up / Sync)
        case "c":
        case "C":
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
    volume,
    onVolumeChange,
    onToggleMute,
    onChangeMedia,
    toggleFullscreen,
    resetControlsTimeout,
  ]);

  return {
    isFullscreen,
    areControlsVisible,
    toggleFullscreen,
    resetControlsTimeout,
  };
}
