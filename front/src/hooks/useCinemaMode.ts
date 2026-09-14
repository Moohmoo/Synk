import { useState, useEffect, useRef, useCallback } from "react";

const CONTROLS_HIDE_DELAY_MS = 2000;

interface WebKitDocument extends Document {
  webkitFullscreenElement?: Element;
  webkitExitFullscreen?: () => Promise<void>;
}

interface WebKitElement extends HTMLElement {
  webkitRequestFullscreen?: () => Promise<void>;
}

function isNativeFullscreen(): boolean {
  const doc = document as WebKitDocument;
  return Boolean(doc.fullscreenElement || doc.webkitFullscreenElement);
}

function requestNativeFullscreen(element: HTMLElement): Promise<void> | void {
  const el = element as WebKitElement;
  const request = el.requestFullscreen || el.webkitRequestFullscreen;
  if (typeof request === "function") {
    return request.call(el);
  }
}

function exitNativeFullscreen(): void {
  const doc = document as WebKitDocument;
  const exit = doc.exitFullscreen || doc.webkitExitFullscreen;
  exit?.call(doc).catch(() => {});
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

export function useCinemaMode({
  containerRef,
  playerStatus,
}: UseCinemaModeOptions): CinemaModeState {
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [areControlsVisible, setAreControlsVisible] = useState<boolean>(true);
  const controlsTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const playerStatusRef = useRef(playerStatus);

  playerStatusRef.current = playerStatus;

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

  useEffect(() => {
    resetControlsTimeout();
    return () => {
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
      }
    };
  }, [playerStatus, resetControlsTimeout]);

  // Bloque le défilement de fond si le mode cinéma utilise le repli In-Window CSS
  useEffect(() => {
    if (!isFullscreen) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [isFullscreen]);

  const toggleFullscreen = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;

    if (isFullscreen || isNativeFullscreen()) {
      if (isNativeFullscreen()) {
        exitNativeFullscreen();
      }
      setIsFullscreen(false);
      setAreControlsVisible(true);
    } else {
      // Tente le plein écran natif W3C/WebKit, bascule sur le repli In-Window CSS si refusé (ex: iOS)
      const reqPromise = requestNativeFullscreen(container);
      if (reqPromise) {
        reqPromise.catch(() => setIsFullscreen(true));
      } else {
        setIsFullscreen(true);
      }
      resetControlsTimeout();
    }
  }, [isFullscreen, containerRef, resetControlsTimeout]);

  // Synchronisation avec la sortie native du plein écran (ex: touche Échap gérée par l'OS)
  useEffect(() => {
    const handleNativeChange = () => {
      const active = isNativeFullscreen();
      setIsFullscreen(active);
      if (!active) {
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
