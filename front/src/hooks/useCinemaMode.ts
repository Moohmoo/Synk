import { useState, useEffect, useRef, useCallback } from "react";

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

  // Réinitialise le minuteur d'inactivité des contrôles
  const resetControlsTimeout = useCallback(() => {
    setAreControlsVisible(true);
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }
    if (playerStatus === "playing") {
      controlsTimeoutRef.current = setTimeout(() => {
        setAreControlsVisible(false);
      }, 2000);
    }
  }, [playerStatus]);

  // Si la vidéo n'est plus en lecture, les contrôles restent toujours visibles
  useEffect(() => {
    if (playerStatus !== "playing") {
      setAreControlsVisible(true);
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
      }
    } else {
      resetControlsTimeout();
    }

    return () => {
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
      }
    };
  }, [playerStatus, isFullscreen, resetControlsTimeout]);

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

  return {
    isFullscreen,
    areControlsVisible,
    toggleFullscreen,
    resetControlsTimeout,
  };
}

export default useCinemaMode;
