import { useState, useEffect, useRef, useCallback } from "react";

const CONTROLS_HIDE_DELAY_MS = 2000;

function isNativeFullscreenActive(): boolean {
  const doc = document as Document & { webkitFullscreenElement?: Element };
  return Boolean(doc.fullscreenElement || doc.webkitFullscreenElement);
}

export interface UseCinemaModeOptions {
  containerRef: React.RefObject<HTMLElement>;
  playerStatus?: string;
}

export interface CinemaModeState {
  isFullscreen: boolean;
  areControlsVisible: boolean;
  toggleFullscreen: () => void;
  resetControlsTimeout: () => void;
}

/**
 * Hook d'ergonomie cinéma :
 * - Gestion du plein écran (API native W3C + WebKit Safari + repli In-Window CSS).
 * - Minuteur d'auto-masquage des contrôles lors de la lecture (2s d'inactivité souris).
 */
export function useCinemaMode({
  containerRef,
  playerStatus,
}: UseCinemaModeOptions): CinemaModeState {
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [areControlsVisible, setAreControlsVisible] = useState<boolean>(true);
  const controlsTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const playerStatusRef = useRef(playerStatus);

  // Synchronise le statut courant sans casser la stabilité des callbacks
  playerStatusRef.current = playerStatus;

  // Réinitialise le minuteur d'inactivité des contrôles (référence stable)
  const resetControlsTimeout = useCallback(() => {
    setAreControlsVisible(true);
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }
    if (playerStatusRef.current === "playing") {
      controlsTimeoutRef.current = setTimeout(() => {
        setAreControlsVisible(false);
      }, CONTROLS_HIDE_DELAY_MS);
    }
  }, []);

  // Synchronise la visibilité dès que le statut de lecture change
  useEffect(() => {
    resetControlsTimeout();
    return () => {
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
      }
    };
  }, [playerStatus, resetControlsTimeout]);

  // Bloque le défilement de la page arrière-plan lors du plein écran In-Window CSS
  useEffect(() => {
    if (!isFullscreen) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [isFullscreen]);

  // Bascule plein écran robuste : support W3C, WebKit Safari et repli CSS In-Window
  const toggleFullscreen = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;

    const isNativeActive = isNativeFullscreenActive();

    if (isFullscreen || isNativeActive) {
      if (isNativeActive) {
        const doc = document as Document & { webkitExitFullscreen?: () => Promise<void> };
        const exit = doc.exitFullscreen || doc.webkitExitFullscreen;
        exit?.call(doc).catch(() => {});
      }
      setIsFullscreen(false);
      setAreControlsVisible(true);
    } else {
      const req =
        container.requestFullscreen ||
        (container as unknown as { webkitRequestFullscreen?: () => Promise<void> }).webkitRequestFullscreen;

      if (typeof req === "function") {
        req.call(container).finally(() => setIsFullscreen(true));
      } else {
        // iPhone Safari : repli immédiat In-Window CSS
        setIsFullscreen(true);
      }
      resetControlsTimeout();
    }
  }, [isFullscreen, containerRef, resetControlsTimeout]);

  // Écouteur des changements natifs de plein écran (ex: touche Échap gérée par l'OS/navigateur)
  useEffect(() => {
    const handleNativeChange = () => {
      const isNative = isNativeFullscreenActive();
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

  return {
    isFullscreen,
    areControlsVisible,
    toggleFullscreen,
    resetControlsTimeout,
  };
}

export default useCinemaMode;
