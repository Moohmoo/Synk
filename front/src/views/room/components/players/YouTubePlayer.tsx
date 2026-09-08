import { useEffect, useRef, useState, useCallback } from "react";
import { AlertCircle, Play } from "lucide-react";
import { useTranslation } from "react-i18next";

declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady: () => void;
  }
}

export interface YouTubePlayerProps {
  mediaId: string;
  isPlaying: boolean;
  currentTime: number;
  duration?: number;
  lastUpdatedAt?: number;
  isLocked: boolean;
  isHost: boolean;
  volume?: number;
  isMuted?: boolean;
  onLocalPlay?: (time: number) => void;
  onLocalPause?: (time: number) => void;
  onDurationChange?: (duration: number) => void;
}

/**
 * Chargeur idempotent du SDK YouTube IFrame API.
 * Garantit qu'un seul tag de script est injecté et résout immédiatement si l'API est déjà prête.
 */
function loadYouTubeSdk(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.YT && window.YT.Player) {
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    const existingScript = document.querySelector('script[src*="youtube.com/iframe_api"]');
    if (!existingScript) {
      const tag = document.createElement("script");
      tag.src = "https://www.youtube.com/iframe_api";
      const firstScriptTag = document.getElementsByTagName("script")[0];
      firstScriptTag?.parentNode?.insertBefore(tag, firstScriptTag);
    }

    const prevReady = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      if (typeof prevReady === "function") {
        try {
          prevReady();
        } catch {
          // ignore
        }
      }
      resolve();
    };

    // Polling de secours au cas où le script était déjà exécuté avant l'assignation du callback
    const interval = setInterval(() => {
      if (window.YT && window.YT.Player) {
        clearInterval(interval);
        resolve();
      }
    }, 50);

    // Filet de sécurité timeout
    setTimeout(() => {
      clearInterval(interval);
      resolve();
    }, 6000);
  });
}

/**
 * Adaptateur lecteur YouTube dédié.
 * Isole le chargement du SDK IFrame API, la machine à états, le Dead Reckoning et la réconciliation idempotente.
 */
export function YouTubePlayer({
  mediaId,
  isPlaying,
  currentTime,
  duration = 0,
  lastUpdatedAt,
  isLocked,
  isHost,
  volume = 100,
  isMuted = false,
  onLocalPlay,
  onLocalPause,
  onDurationChange,
}: YouTubePlayerProps) {
  const { t } = useTranslation("room");
  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<any>(null);
  const isPlayerReadyRef = useRef(false);
  const isInitializingRef = useRef(false);
  const isMountedRef = useRef(true);
  const mountIdRef = useRef(`yt-player-${Math.random().toString(36).slice(2, 9)}`);
  const currentMediaIdRef = useRef(mediaId);
  const mediaIdRef = useRef(mediaId);
  mediaIdRef.current = mediaId;

  // Verrou d'intention de réconciliation (évite les échos réseau lors d'un seek ou sync)
  const isReconcilingRef = useRef(false);
  const fallbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Maintien de références à jour pour le calcul du Dead Reckoning et l'évitement des stale closures
  const isPlayingRef = useRef(isPlaying);
  isPlayingRef.current = isPlaying;

  const currentTimeRef = useRef(currentTime);
  currentTimeRef.current = currentTime;

  const durationRef = useRef(duration);
  durationRef.current = duration;

  const lastUpdatedAtRef = useRef(lastUpdatedAt);
  lastUpdatedAtRef.current = lastUpdatedAt;

  const isLockedRef = useRef(isLocked);
  isLockedRef.current = isLocked;

  const isHostRef = useRef(isHost);
  isHostRef.current = isHost;

  const volumeRef = useRef(volume);
  volumeRef.current = volume;

  const isMutedRef = useRef(isMuted);
  isMutedRef.current = isMuted;

  const onLocalPlayRef = useRef(onLocalPlay);
  onLocalPlayRef.current = onLocalPlay;

  const onLocalPauseRef = useRef(onLocalPause);
  onLocalPauseRef.current = onLocalPause;

  const onDurationChangeRef = useRef(onDurationChange);
  onDurationChangeRef.current = onDurationChange;

  const [playerState, setPlayerState] = useState<number>(-1);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPlayerVisible, setIsPlayerVisible] = useState<boolean>(false);
  const initWatchdogTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const getEstimatedTime = () => {
    if (!isPlayingRef.current) {
      return currentTimeRef.current;
    }
    const anchor = lastUpdatedAtRef.current || Date.now();
    const elapsedSec = Math.max(0, (Date.now() - anchor) / 1000);
    const estimated = currentTimeRef.current + elapsedSec;
    if (durationRef.current > 0) {
      return Math.min(estimated, durationRef.current);
    }
    return estimated;
  };

  const emitDuration = (target: any) => {
    if (target && typeof target.getDuration === "function") {
      const d = target.getDuration();
      if (typeof d === "number" && d > 0) {
        durationRef.current = d;
        if (onDurationChangeRef.current) {
          onDurationChangeRef.current(d);
        }
      }
    }
  };

  // Instanciation idempotente et isolée du lecteur YouTube
  const initPlayer = useCallback(() => {
    if (!containerRef.current || !isMountedRef.current) return;
    if (!window.YT || !window.YT.Player) return;
    if (isInitializingRef.current) return;

    isInitializingRef.current = true;

    // Nettoyer toute instance précédente
    if (playerRef.current) {
      try {
        if (typeof playerRef.current.destroy === "function") {
          playerRef.current.destroy();
        }
      } catch {
        // ignore
      }
      playerRef.current = null;
    }

    setIsPlayerVisible(false);
    isPlayerReadyRef.current = false;
    containerRef.current.innerHTML = "";

    // Watchdog de secours : si onReady ne répond pas après 3.5s (handshake rompu suite à navigation arrière)
    if (initWatchdogTimerRef.current) {
      clearTimeout(initWatchdogTimerRef.current);
    }
    initWatchdogTimerRef.current = setTimeout(() => {
      if (isMountedRef.current && !isPlayerReadyRef.current) {
        console.warn("[YouTubePlayer] Handshake timeout (iframe bloquée sur navigation arrière), régénération...");
        isInitializingRef.current = false;
        initPlayer();
      }
    }, 3500);

    // Créer une cible DOM dédiée avec fond noir natif et id unique (évite toute collision d'iframe)
    mountIdRef.current = `yt-player-${Math.random().toString(36).slice(2, 9)}`;
    const mountTarget = document.createElement("div");
    mountTarget.id = mountIdRef.current;
    mountTarget.style.width = "100%";
    mountTarget.style.height = "100%";
    mountTarget.style.backgroundColor = "#000000";
    containerRef.current.appendChild(mountTarget);

    const targetMediaId = mediaIdRef.current;
    currentMediaIdRef.current = targetMediaId;

    const initialTargetTime = getEstimatedTime();

    playerRef.current = new window.YT.Player(mountTarget.id, {
      width: "100%",
      height: "100%",
      videoId: targetMediaId,
      host: "https://www.youtube-nocookie.com",
      playerVars: {
        autoplay: isPlayingRef.current ? 1 : 0,
        start: Math.max(0, Math.floor(initialTargetTime)),
        controls: 0,
        rel: 0,
        modestbranding: 1,
        enablejsapi: 1,
        fs: 0,
        disablekb: 1,
        iv_load_policy: 3,
        origin: window.location.origin,
        widget_referrer: window.location.href,
      },
      events: {
        onReady: (event: any) => {
          if (initWatchdogTimerRef.current) {
            clearTimeout(initWatchdogTimerRef.current);
            initWatchdogTimerRef.current = null;
          }
          isInitializingRef.current = false;
          if (!isMountedRef.current) return;
          isPlayerReadyRef.current = true;
          setIsPlayerVisible(true);
          setErrorMessage(null);
          setPlayerState(-1);
          emitDuration(event.target);

          // Verrouiller l'intention de réconciliation pour bloquer tout autoplay spontané de YouTube lors du montage
          isReconcilingRef.current = true;
          if (fallbackTimerRef.current) {
            clearTimeout(fallbackTimerRef.current);
          }
          fallbackTimerRef.current = setTimeout(() => {
            isReconcilingRef.current = false;
          }, 2000);

          const targetTime = getEstimatedTime();
          // Si mediaId a changé pendant l'initialisation du lecteur
          if (currentMediaIdRef.current && currentMediaIdRef.current !== targetMediaId) {
            if (isPlayingRef.current) {
              event.target.loadVideoById({
                videoId: currentMediaIdRef.current,
                startSeconds: targetTime,
              });
            } else {
              if (typeof event.target.cueVideoById === "function") {
                event.target.cueVideoById({
                  videoId: currentMediaIdRef.current,
                  startSeconds: targetTime,
                });
              } else {
                event.target.loadVideoById({
                  videoId: currentMediaIdRef.current,
                  startSeconds: targetTime,
                });
                event.target.pauseVideo();
              }
            }
          } else {
            const currentLocalTime = event.target.getCurrentTime ? event.target.getCurrentTime() : 0;
            if (Math.abs(currentLocalTime - targetTime) > 1.5 && targetTime > 0) {
              event.target.seekTo(targetTime, true);
            }
          }

          // Configuration initiale du volume
          const shouldMute = isMutedRef.current || volumeRef.current === 0;
          if (shouldMute) {
            if (typeof event.target.mute === "function") event.target.mute();
            if (typeof event.target.setVolume === "function") event.target.setVolume(0);
          } else {
            if (typeof event.target.unMute === "function") event.target.unMute();
            if (typeof event.target.setVolume === "function") event.target.setVolume(volumeRef.current);
          }

          if (isPlayingRef.current) {
            event.target.playVideo();
          } else {
            event.target.pauseVideo();
          }
        },
        onStateChange: (event: any) => {
          if (!isMountedRef.current) return;
          setPlayerState(event.data);
          emitDuration(event.target);

          // Phase de stabilisation (Intent Lock) :
          if (isReconcilingRef.current) {
            if (event.data === 3 || event.data === -1) {
              return;
            }

            const expectedState = isPlayingRef.current ? 1 : 2;
            if (event.data === expectedState) {
              isReconcilingRef.current = false;
              if (fallbackTimerRef.current) {
                clearTimeout(fallbackTimerRef.current);
                fallbackTimerRef.current = null;
              }
              return;
            }

            // Si YouTube se met à lire spontanément alors que le salon est en pause
            if (!isPlayingRef.current && event.data === 1) {
              event.target.pauseVideo();
            }
            return;
          }

          // Vérification des droits d'hôte
          if (isLockedRef.current && !isHostRef.current) {
            return;
          }

          const currentLocalTime = event.target.getCurrentTime
            ? event.target.getCurrentTime()
            : 0;

          if (event.data === 1) { // PLAYING
            const estimatedTime = getEstimatedTime();
            const drift = Math.abs(currentLocalTime - estimatedTime);

            if (isPlayingRef.current) {
              // Replay natif initié depuis YouTube (la tête repart à 0 alors que le salon était en fin de vidéo)
              const wasAtEnd = durationRef.current > 0 && estimatedTime >= durationRef.current - 1.0;
              if (wasAtEnd && currentLocalTime < 2.0) {
                if (onLocalPlayRef.current) {
                  onLocalPlayRef.current(0);
                }
                return;
              }

              if (drift > 1.5) {
                isReconcilingRef.current = true;
                event.target.seekTo(estimatedTime, true);
                setTimeout(() => {
                  isReconcilingRef.current = false;
                }, 1000);
              }
              return;
            }

            // Si le lecteur n'est pas encore totalement stabilisé, forcer la pause au lieu d'émettre
            if (!isPlayerReadyRef.current) {
              event.target.pauseVideo();
              return;
            }

            // Démarrage initié localement alors que le salon était en pause
            const isEnded = durationRef.current > 0 && currentLocalTime >= durationRef.current - 0.5;
            if (onLocalPlayRef.current) {
              onLocalPlayRef.current(isEnded ? 0 : currentLocalTime);
            }
          } else if (event.data === 2) { // PAUSED
            if (isPlayingRef.current && onLocalPauseRef.current) {
              onLocalPauseRef.current(currentLocalTime);
            }
          } else if (event.data === 0) { // ENDED
            if (isPlayingRef.current && onLocalPauseRef.current) {
              const endTime = durationRef.current > 0 ? durationRef.current : currentLocalTime;
              onLocalPauseRef.current(endTime);
            }
          }
        },
        onError: (event: any) => {
          if (initWatchdogTimerRef.current) {
            clearTimeout(initWatchdogTimerRef.current);
            initWatchdogTimerRef.current = null;
          }
          isInitializingRef.current = false;
          setIsPlayerVisible(true);
          if (!isMountedRef.current) return;
          console.error("[YouTubePlayer] Erreur YouTube code :", event.data);
          const code = event.data;
          if (code === 101 || code === 150) {
            setErrorMessage("Lecture interdite sur les sites tiers par l'auteur de la vidéo.");
          } else if (code === 100) {
            setErrorMessage("Vidéo introuvable, supprimée ou privée.");
          } else if (code === 2) {
            setErrorMessage("Identifiant vidéo YouTube invalide.");
          } else {
            setErrorMessage("Impossible de lire cette vidéo dans le lecteur.");
          }
        },
      },
    });
  }, []);

  // Test de santé de l'instance du lecteur (détecte les iframes tuées en arrière-plan, about:blank ou bloquées)
  const isHealthy = useCallback((): boolean => {
    if (!playerRef.current || !isPlayerReadyRef.current) return false;
    try {
      const iframe = containerRef.current?.querySelector("iframe");
      if (!iframe) return false;
      if (iframe.src === "about:blank" || !iframe.src || iframe.src.includes("about:blank")) {
        return false;
      }
      const state = playerRef.current.getPlayerState?.();
      return typeof state === "number";
    } catch {
      return false;
    }
  }, []);

  // 1. Montage initial du lecteur dans le DOM
  useEffect(() => {
    isMountedRef.current = true;

    loadYouTubeSdk().then(() => {
      if (isMountedRef.current) {
        initPlayer();
      }
    });

    return () => {
      isMountedRef.current = false;
      isInitializingRef.current = false;
      isPlayerReadyRef.current = false;
      setIsPlayerVisible(false);
      if (initWatchdogTimerRef.current) {
        clearTimeout(initWatchdogTimerRef.current);
        initWatchdogTimerRef.current = null;
      }
      if (fallbackTimerRef.current) {
        clearTimeout(fallbackTimerRef.current);
      }
      if (playerRef.current) {
        try {
          if (typeof playerRef.current.destroy === "function") {
            playerRef.current.destroy();
          }
        } catch {
          // ignore
        }
        playerRef.current = null;
      }
      if (containerRef.current) {
        containerRef.current.innerHTML = "";
      }
    };
  }, [initPlayer]);

  // Détection de navigation arrière/avant dans l'historique de la SPA (Undo / Back)
  useEffect(() => {
    const handlePopState = () => {
      setTimeout(() => {
        if (!isMountedRef.current) return;
        if (!isHealthy()) {
          console.log("[YouTubePlayer] Navigation arrière (popstate) détectée et lecteur inactif : réinitialisation propre");
          setIsPlayerVisible(false);
          isInitializingRef.current = false;
          initPlayer();
        }
      }, 50);
    };

    window.addEventListener("popstate", handlePopState);
    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
  }, [initPlayer, isHealthy]);

  // Résurrection du lecteur au retour sur l'onglet (Tab Discarding / suspension Chromium / BFCache)
  useEffect(() => {
    const handleResume = () => {
      setTimeout(() => {
        if (!isMountedRef.current) return;
        if (!isHealthy()) {
          console.log("[YouTubePlayer] Lecteur inactif ou déchargé en arrière-plan, réinitialisation propre...");
          setIsPlayerVisible(false);
          isInitializingRef.current = false;
          initPlayer();
        } else {
          try {
            emitDuration(playerRef.current);
            const currentLocalTime = playerRef.current.getCurrentTime ? playerRef.current.getCurrentTime() : 0;
            const targetTime = getEstimatedTime();
            if (Math.abs(currentLocalTime - targetTime) > 2.0) {
              isReconcilingRef.current = true;
              playerRef.current.seekTo(targetTime, true);
              setTimeout(() => {
                isReconcilingRef.current = false;
              }, 1000);
            }
            if (isPlayingRef.current && playerRef.current.getPlayerState?.() !== 1) {
              playerRef.current.playVideo?.();
            }
          } catch {
            setIsPlayerVisible(false);
            isInitializingRef.current = false;
            initPlayer();
          }
        }
      }, 300);
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        handleResume();
      }
    };

    const handlePageShow = (event: PageTransitionEvent) => {
      if (event.persisted || !isHealthy()) {
        handleResume();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("pageshow", handlePageShow);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("pageshow", handlePageShow);
    };
  }, [initPlayer, isHealthy]);

  // 2. Changement de vidéo fluide (sans recréer l'iframe)
  useEffect(() => {
    if (!mediaId) return;

    if (currentMediaIdRef.current === mediaId && isPlayerReadyRef.current) {
      return;
    }
    currentMediaIdRef.current = mediaId;

    if (
      playerRef.current &&
      isPlayerReadyRef.current
    ) {
      setErrorMessage(null);
      setPlayerState(-1);
      isReconcilingRef.current = true;
      if (fallbackTimerRef.current) {
        clearTimeout(fallbackTimerRef.current);
      }
      fallbackTimerRef.current = setTimeout(() => {
        isReconcilingRef.current = false;
      }, 2000);

      const targetTime = getEstimatedTime();

      if (isPlayingRef.current) {
        if (typeof playerRef.current.loadVideoById === "function") {
          playerRef.current.loadVideoById({
            videoId: mediaId,
            startSeconds: targetTime,
          });
        }
        emitDuration(playerRef.current);
        playerRef.current.playVideo?.();
      } else {
        if (typeof playerRef.current.cueVideoById === "function") {
          playerRef.current.cueVideoById({
            videoId: mediaId,
            startSeconds: targetTime,
          });
        } else if (typeof playerRef.current.loadVideoById === "function") {
          playerRef.current.loadVideoById({
            videoId: mediaId,
            startSeconds: targetTime,
          });
          playerRef.current.pauseVideo?.();
        }
        emitDuration(playerRef.current);
        playerRef.current.pauseVideo?.();
      }
    }
  }, [mediaId]);

  // 3. Réconciliation déterministe de l'état de lecture depuis le WebSocket
  useEffect(() => {
    if (!playerRef.current || !isPlayerReadyRef.current || !playerRef.current.getPlayerState) return;

    try {
      emitDuration(playerRef.current);
      const state = playerRef.current.getPlayerState();
      const currentLocalTime = playerRef.current.getCurrentTime
        ? playerRef.current.getCurrentTime()
        : 0;

      const targetTime = getEstimatedTime();
      const timeDrift = Math.abs(currentLocalTime - targetTime);
      const needsSeek = timeDrift > 1.5;
      const needsPlay = isPlaying && state !== 1;
      const needsPause = !isPlaying && state === 1;

      if (needsSeek || needsPlay || needsPause) {
        // Enclencher le verrou d'intention de réconciliation
        isReconcilingRef.current = true;
        if (fallbackTimerRef.current) {
          clearTimeout(fallbackTimerRef.current);
        }
        // Filet de sécurité maximal (timeout de secours si l'IFrame ne répond pas)
        fallbackTimerRef.current = setTimeout(() => {
          isReconcilingRef.current = false;
        }, 2000);

        if (needsSeek) {
          playerRef.current.seekTo(targetTime, true);
        }

        if (needsPlay) {
          playerRef.current.playVideo?.();
        } else if (needsPause || !isPlaying) {
          playerRef.current.pauseVideo?.();
        }
      }
    } catch {
      // Le player n'est pas encore totalement initialisé
    }
  }, [isPlaying, currentTime, lastUpdatedAt]);

  const handleManualSync = () => {
    if (!playerRef.current || !isPlayerReadyRef.current) {
      initPlayer();
      return;
    }
    try {
      const targetTime = getEstimatedTime();
      isReconcilingRef.current = true;
      if (fallbackTimerRef.current) {
        clearTimeout(fallbackTimerRef.current);
      }
      fallbackTimerRef.current = setTimeout(() => {
        isReconcilingRef.current = false;
      }, 3000);

      if (typeof playerRef.current.seekTo === "function") {
        playerRef.current.seekTo(targetTime, true);
      }
      if (typeof playerRef.current.playVideo === "function") {
        playerRef.current.playVideo();
      }
    } catch (e) {
      console.error("[YouTubePlayer] Erreur synchronisation manuelle, tentative de réinitialisation :", e);
      initPlayer();
    }
  };

  // 4. Volume local (sans émission réseau)
  useEffect(() => {
    if (!playerRef.current || !isPlayerReadyRef.current) return;
    try {
      const shouldMute = isMuted || volume === 0;
      if (shouldMute) {
        if (typeof playerRef.current.mute === "function") {
          playerRef.current.mute();
        }
        if (typeof playerRef.current.setVolume === "function") {
          playerRef.current.setVolume(0);
        }
      } else {
        if (typeof playerRef.current.unMute === "function") {
          playerRef.current.unMute();
        }
        if (typeof playerRef.current.setVolume === "function") {
          playerRef.current.setVolume(volume);
        }
      }
    } catch {
      // Ignorer si le player est en cours d'initialisation
    }
  }, [volume, isMuted]);

  return (
    <div className="w-full h-full relative flex items-center justify-center bg-black overflow-hidden">
      <div
        ref={containerRef}
        className={`w-full h-full transition-opacity duration-300 ${
          isPlayerVisible ? "opacity-100" : "opacity-0 pointer-events-none"
        } ${isLocked && !isHost ? "pointer-events-none" : ""}`}
      />

      {/* Bouclier noir et indicateur de chargement : empêche tout flash ou iframe blanc */}
      {!isPlayerVisible && !errorMessage && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-black select-none">
          <div className="w-8 h-8 border-2 border-[#0ac8b9] border-t-transparent rounded-full animate-spin mb-3" />
          <span className="text-[11px] font-mono text-zinc-500 uppercase tracking-wider">
            {t("player.syncing", { defaultValue: "Initialisation du lecteur..." })}
          </span>
        </div>
      )}

      {/* Bannière d'incitation à la synchronisation si bloqué par l'Autoplay Policy du navigateur */}
      {isPlaying && (playerState === -1 || playerState === 5) && !errorMessage && (
        <button
          type="button"
          onClick={handleManualSync}
          className="absolute top-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2.5 px-4 py-2 bg-[#09090b]/90 hover:bg-[#18181b] border border-[#0ac8b9]/40 hover:border-[#0ac8b9] text-zinc-100 rounded-full shadow-xl shadow-black/50 backdrop-blur-md transition-all cursor-pointer group animate-pulse"
        >
          <div className="w-6 h-6 rounded-full bg-[#0ac8b9]/20 flex items-center justify-center text-[#0ac8b9] group-hover:scale-110 transition-transform">
            <Play className="w-3 h-3 fill-current ml-0.5" />
          </div>
          <div className="flex flex-col text-left">
            <span className="text-[11px] font-bold text-zinc-200 uppercase tracking-wider">
              {t("player.syncOverlayTitle")}
            </span>
            <span className="text-[10px] text-zinc-400">
              {t("player.syncOverlaySubtitle")}
            </span>
          </div>
        </button>
      )}

      {errorMessage && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-[#0a0a0c]/95 p-6 text-center select-none backdrop-blur-sm">
          <AlertCircle className="w-10 h-10 text-rose-500 mb-3" />
          <p className="text-sm font-semibold text-zinc-200 mb-1">{errorMessage}</p>
          <p className="text-xs text-zinc-500 max-w-sm leading-relaxed">
            L'auteur ou les ayants droit de cette vidéo ont restreint son intégration sur des sites tiers.
          </p>
        </div>
      )}
    </div>
  );
}
