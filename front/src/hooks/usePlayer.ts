import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { PlayerState } from "@/types/room";
import { PlaybackStatus } from "@/types/player";
import { calculateReferenceTime } from "@/lib/utils";
import {
  DESYNC_THRESHOLD_SECONDS,
  END_THRESHOLD_SECONDS,
  DOM_SYNC_DRIFT_THRESHOLD_SECONDS,
} from "@/lib/constants";

// Ré-export pour rétrocompatibilité et co-localisation
export type { PlaybackStatus };

export interface UsePlayerOptions {
  player: PlayerState;
  isHost: boolean;
  isLocked: boolean;
  isRateLimited?: (action: string) => boolean;
  sendPlay: (currentTime?: number, duration?: number, isRestart?: boolean) => void;
  sendPause: (currentTime?: number, duration?: number) => void;
  sendSeek: (targetTime: number, duration?: number) => void;
  sendHeartbeat?: (currentTime?: number) => void;
  serverTimeOffset?: number;
  initialVolume?: number;
}

export interface PlayerController {
  // Référence DOM vers le lecteur vidéo
  videoRef: React.RefObject<HTMLVideoElement>;

  // Source média résolue
  mediaUrl: string;
  provider?: string;

  // Machine d'état unifiée (remplace la forêt de booléens)
  status: PlaybackStatus;

  // Position et Durée (Uniques sources de vérité)
  currentTime: number;
  duration: number;
  displayTime: number;
  roomTime: number;

  // Options & Confort de visionnage
  subtitlesEnabled: boolean;
  toggleSubtitles: () => void;
  isPiPSupported: boolean;
  isPiPActive: boolean;
  togglePictureInPicture: () => Promise<void>;

  // Détection de retard (Bouton Rattraper)
  isBehind: boolean;
  needsAutoplayUnlock: boolean;

  // Permissions & Limiteurs de débit
  isPlayDisabled: boolean;
  isSeekDisabled: boolean;

  // Volume local et sourdine persistée
  volume: number;
  isMuted: boolean;
  setVolume: (volume: number) => void;
  toggleMute: () => void;

  // Commandes explicites de l'utilisateur
  play: () => void;
  pause: () => void;
  togglePlay: () => void;
  replay: () => void;
  seek: (time: number) => void;
  catchUp: () => void;
  scrub: (time: number | null) => void;
  unlockAutoplay: () => void;

  // Props prêtes à l'emploi pour le composant ReactPlayer
  playerProps: {
    onTimeUpdate: () => void;
    onDurationChange: () => void;
    onEnded: () => void;
    onError: () => void;
    onSeeked?: () => void;
  };
}

/**
 * Détermine si une position temporelle est considérée comme la fin de lecture du média.
 */
function isNearEnd(time: number, duration: number): boolean {
  return duration > 0 && time >= duration - END_THRESHOLD_SECONDS;
}

/**
 * Résout l'URL complète d'un média à partir de son identifiant et de son fournisseur.
 */
export function resolveMediaUrl(player: PlayerState): string {
  if (player.media_url) return player.media_url;
  if (!player.media_id) return "";
  const provider = player.provider || "youtube";
  if (provider === "youtube") return `https://www.youtube.com/watch?v=${player.media_id}`;
  if (provider === "twitch") return `https://www.twitch.tv/${player.media_id}`;
  if (provider === "vimeo") return `https://vimeo.com/${player.media_id}`;
  return player.media_id;
}

/**
 * Hook central orchestrant le lecteur vidéo, la machine à états, le volume et la synchronisation salon.
 */
export function usePlayer({
  player,
  isHost,
  isLocked,
  isRateLimited,
  sendPlay,
  sendPause,
  sendSeek,
  sendHeartbeat,
  serverTimeOffset = 0,
  initialVolume = 100,
}: UsePlayerOptions): PlayerController {
  const videoRef = useRef<HTMLVideoElement>(null);

  // Volume local et sourdine persistée
  const [volume, setVolumeState] = useState<number>(() => {
    const saved = localStorage.getItem("synk_volume");
    return saved !== null ? Number(saved) : initialVolume;
  });
  const [isMuted, setIsMuted] = useState<boolean>(false);

  const setVolume = useCallback((newVolume: number) => {
    setVolumeState(newVolume);
    localStorage.setItem("synk_volume", String(newVolume));
  }, []);

  const toggleMute = useCallback(() => {
    setIsMuted((prevMuted) => {
      if (prevMuted) {
        if (volume === 0) setVolume(50);
        return false;
      }
      return true;
    });
  }, [volume, setVolume]);

  // Source média résolue
  const mediaUrl = useMemo(
    () => resolveMediaUrl(player),
    [player.media_url, player.media_id, player.provider]
  );

  // États locaux de lecture
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [mediaElementDuration, setMediaElementDuration] = useState<number>(0);
  const [scrubbingTime, setScrubbingTime] = useState<number | null>(null);
  const [hasError, setHasError] = useState<boolean>(false);
  const [needsAutoplayUnlock, setNeedsAutoplayUnlock] = useState<boolean>(false);

  const hasInitialSyncDoneRef = useRef<boolean>(false);

  // Réinitialisation synchrone pendant le render lors d'un changement d'URL
  // (Pattern React recommandé évitant les cascades de re-renders dues à un useEffect)
  const [prevMediaUrl, setPrevMediaUrl] = useState<string>(mediaUrl);
  if (mediaUrl !== prevMediaUrl) {
    setPrevMediaUrl(mediaUrl);
    hasInitialSyncDoneRef.current = false;
    setCurrentTime(0);
    setMediaElementDuration(0);
    setScrubbingTime(null);
    setHasError(false);
    setNeedsAutoplayUnlock(false);
  }

  const lastHandledUpdateRef = useRef<number>(player.last_updated_at);
  const pendingSeekRef = useRef<number | null>(null);

  // Durée unifiée (priorité au serveur, repli sur la durée détectée par l'élément vidéo)
  const duration = player.duration && player.duration > 0 ? player.duration : mediaElementDuration;

  // Position affichée dans la timeline (priorité au déplacement du slider)
  const displayTime = scrubbingTime !== null ? scrubbingTime : currentTime;

  // Position théorique du salon (compensée par l'offset d'horloge NTP)
  const roomTime = calculateReferenceTime({ ...player, duration }, serverTimeOffset);

  // Machine d'état unifiée : statut dérivé sans état booléen redondant
  const status: PlaybackStatus = useMemo(() => {
    if (!mediaUrl) return "idle";
    if (hasError) return "error";
    if (
      isNearEnd(currentTime, duration) ||
      (!player.is_playing && isNearEnd(player.current_time, duration))
    ) {
      return "ended";
    }
    if (player.is_playing) return "playing";
    return "paused";
  }, [mediaUrl, hasError, currentTime, duration, player.is_playing, player.current_time]);

  // Détection de retard (Bouton Rattraper)
  const isBehind =
    player.is_playing &&
    duration > 0 &&
    status !== "ended" &&
    !isNearEnd(roomTime, duration) &&
    scrubbingTime === null &&
    roomTime - currentTime > DESYNC_THRESHOLD_SECONDS;

  // Permissions de contrôle
  const isRestrictedForGuest = isLocked && !isHost;
  const isPlayDisabled =
    isRestrictedForGuest ||
    !player.media_id ||
    Boolean(isRateLimited?.("PLAY") || isRateLimited?.("PAUSE"));
  const isSeekDisabled =
    isRestrictedForGuest ||
    duration === 0 ||
    !player.media_id ||
    Boolean(isRateLimited?.("SEEK"));

  // Helper factorisé pour mettre en pause le salon de façon sécurisée
  const pauseIfPlaying = useCallback(
    (atTime: number) => {
      const isEnd = duration > 0 && atTime >= duration - END_THRESHOLD_SECONDS;
      const canPause = !isRestrictedForGuest || isEnd;
      if (player.is_playing && canPause && !isRateLimited?.("PAUSE")) {
        sendPause(atTime, duration);
      }
    },
    [player.is_playing, isRestrictedForGuest, isRateLimited, sendPause, duration]
  );

  // Synchronisation temporelle impérative avec les ordres du salon (DOM uniquement)
  useEffect(() => {
    if (lastHandledUpdateRef.current === player.last_updated_at) return;
    lastHandledUpdateRef.current = player.last_updated_at;

    const target = roomTime;
    setScrubbingTime(null);
    setCurrentTime(target);

    if (videoRef.current) {
      const local = videoRef.current.currentTime || 0;
      const isAlreadySeekingToTarget =
        pendingSeekRef.current !== null &&
        Math.abs(pendingSeekRef.current - target) <= DOM_SYNC_DRIFT_THRESHOLD_SECONDS;

      if (!isAlreadySeekingToTarget && Math.abs(local - target) > DOM_SYNC_DRIFT_THRESHOLD_SECONDS) {
        pendingSeekRef.current = target;
        videoRef.current.currentTime = target;
      }
    }
  }, [player.last_updated_at, roomTime]);

  // Resynchronisation automatique au retour sur l'onglet si dérive détectée (Page Visibility API)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState !== "visible" || !player.is_playing) return;

      const target = calculateReferenceTime({ ...player, duration }, serverTimeOffset);
      if (videoRef.current) {
        const local = videoRef.current.currentTime || 0;
        if (Math.abs(local - target) > DOM_SYNC_DRIFT_THRESHOLD_SECONDS) {
          pendingSeekRef.current = target;
          videoRef.current.currentTime = target;
          setCurrentTime(target);
        }
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [player, duration, serverTimeOffset]);

  // Monitoring temps réel de dérive vers le serveur (toutes les 2 secondes pendant la lecture)
  const latestCurrentTimeRef = useRef<number>(currentTime);
  latestCurrentTimeRef.current = currentTime;

  useEffect(() => {
    if (!player.is_playing || !sendHeartbeat) return;

    const interval = setInterval(() => {
      const current = videoRef.current?.currentTime ?? latestCurrentTimeRef.current;
      sendHeartbeat(current);
    }, 2000);

    return () => clearInterval(interval);
  }, [player.is_playing, sendHeartbeat]);

  // Commandes explicites de l'utilisateur
  const play = useCallback(() => {
    if (isPlayDisabled) return;
    sendPlay(currentTime, duration, false);
  }, [isPlayDisabled, sendPlay, currentTime, duration]);

  const pause = useCallback(() => {
    if (isPlayDisabled) return;
    sendPause(currentTime, duration);
  }, [isPlayDisabled, sendPause, currentTime, duration]);

  const replay = useCallback(() => {
    if (isPlayDisabled) return;
    pendingSeekRef.current = 0;
    if (videoRef.current) {
      videoRef.current.currentTime = 0;
      // Amorçage immédiat pour satisfaire la politique d'autoplay des navigateurs stricts (iOS / Safari)
      videoRef.current.play().catch(() => {});
    }
    setScrubbingTime(null);
    setCurrentTime(0);
    sendPlay(0, duration, true);
  }, [isPlayDisabled, sendPlay, duration]);

  const togglePlay = useCallback(() => {
    if (status === "ended") {
      replay();
    } else if (status === "playing") {
      pause();
    } else {
      play();
    }
  }, [status, replay, pause, play]);

  const seek = useCallback(
    (targetTime: number) => {
      setScrubbingTime(null);
      if (isSeekDisabled) return;
      const clamped =
        duration > 0 ? Math.min(Math.max(0, targetTime), duration) : Math.max(0, targetTime);
      const atEnd = isNearEnd(clamped, duration);

      pendingSeekRef.current = clamped;
      if (videoRef.current) {
        videoRef.current.currentTime = clamped;
      }
      setCurrentTime(clamped);

      // Si la vidéo était terminée et qu'on cherche ailleurs, reprise immédiate de lecture
      if (status === "ended" && !atEnd) {
        if (videoRef.current) {
          videoRef.current.play().catch(() => {});
        }
        sendPlay(clamped, duration, clamped === 0);
      } else if (atEnd && player.is_playing) {
        pauseIfPlaying(clamped);
      } else {
        sendSeek(clamped, duration);
      }
    },
    [isSeekDisabled, duration, status, player.is_playing, pauseIfPlaying, sendPlay, sendSeek]
  );

  const catchUp = useCallback(() => {
    setScrubbingTime(null);
    const safeTarget =
      duration > 0 ? Math.min(roomTime, Math.max(0, duration - END_THRESHOLD_SECONDS)) : roomTime;
    pendingSeekRef.current = safeTarget;
    if (videoRef.current) {
      videoRef.current.currentTime = safeTarget;
    }
    setCurrentTime(safeTarget);
  }, [duration, roomTime]);

  const scrub = useCallback((time: number | null) => {
    setScrubbingTime(time);
  }, []);

  const unlockAutoplay = useCallback(() => {
    if (videoRef.current) {
      videoRef.current
        .play()
        .then(() => setNeedsAutoplayUnlock(false))
        .catch(() => {});
    } else {
      setNeedsAutoplayUnlock(false);
    }
  }, []);

  // Sous-titres : mémorisation locale et bascule
  const [subtitlesEnabled, setSubtitlesEnabled] = useState<boolean>(() => {
    return localStorage.getItem("synk_subtitles") === "true";
  });

  const toggleSubtitles = useCallback(() => {
    setSubtitlesEnabled((prev) => {
      const next = !prev;
      localStorage.setItem("synk_subtitles", String(next));

      // 1. YouTube IFrame Player API
      try {
        const internal = (videoRef.current as any)?.getInternalPlayer?.();
        if (internal) {
          if (next) {
            if (typeof internal.loadModule === "function") internal.loadModule("captions");
          } else {
            if (typeof internal.unloadModule === "function") internal.unloadModule("captions");
          }
        }
      } catch (err) {
        console.warn("[SUBTITLES] YouTube captions error", err);
      }

      // 2. Fichiers vidéo directs HTML5 (MP4 / WebM / HLS / Dash)
      try {
        const videoEl =
          (videoRef.current as unknown as { getInternalPlayer?: () => HTMLVideoElement })
            .getInternalPlayer?.() || videoRef.current;
        if (videoEl?.textTracks && videoEl.textTracks.length > 0) {
          for (let i = 0; i < videoEl.textTracks.length; i++) {
            videoEl.textTracks[i].mode = next ? "showing" : "disabled";
          }
        }
      } catch (err) {
        console.warn("[SUBTITLES] HTML5 textTracks error", err);
      }

      return next;
    });
  }, []);

  // Raccourci clavier 'C' pour basculer les sous-titres (hors champs texte)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() !== "c") return;
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      ) {
        return;
      }
      e.preventDefault();
      toggleSubtitles();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [toggleSubtitles]);

  // Mini-lecteur (Picture-in-Picture) standard W3C
  const isPiPSupported =
    typeof document !== "undefined" &&
    "pictureInPictureEnabled" in document &&
    Boolean(document.pictureInPictureEnabled);

  const [isPiPActive, setIsPiPActive] = useState<boolean>(false);

  useEffect(() => {
    const handleEnterPiP = () => setIsPiPActive(true);
    const handleLeavePiP = () => setIsPiPActive(false);

    document.addEventListener("enterpictureinpicture", handleEnterPiP);
    document.addEventListener("leavepictureinpicture", handleLeavePiP);
    return () => {
      document.removeEventListener("enterpictureinpicture", handleEnterPiP);
      document.removeEventListener("leavepictureinpicture", handleLeavePiP);
    };
  }, []);

  const togglePictureInPicture = useCallback(async () => {
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      } else if (videoRef.current) {
        const internal =
          (videoRef.current as unknown as { getInternalPlayer?: () => HTMLVideoElement }).getInternalPlayer?.() ||
          videoRef.current;
        if (internal && typeof internal.requestPictureInPicture === "function") {
          await internal.requestPictureInPicture();
        }
      }
    } catch {
      // Ignorer silencieusement si rejeté par le navigateur (ex: pas d'activation utilisateur ou iframe cross-origin)
    }
  }, []);

  // Callbacks DOM pour ReactPlayer
  const onTimeUpdate = useCallback(() => {
    if (!videoRef.current) return;
    const cur = videoRef.current.currentTime;

    const wasSeekingToZero = pendingSeekRef.current === 0;

    // Ignore les frames résiduelles tant que le saut asynchrone n'a pas convergé
    if (pendingSeekRef.current !== null) {
      if (Math.abs(cur - pendingSeekRef.current) > 1.0) return;
      pendingSeekRef.current = null;
    }

    if (isNearEnd(cur, duration)) {
      if (currentTime !== duration) {
        setCurrentTime(duration);
        pauseIfPlaying(duration);
      }
      return;
    }
    // Évite le saut parasite à 0 si YouTube boucle en fin de vidéo sans replay explicite
    if (!wasSeekingToZero && cur === 0 && duration > 2 && currentTime >= duration - 1) return;
    setCurrentTime(cur);
  }, [duration, currentTime, pauseIfPlaying]);

  const onDurationChange = useCallback(() => {
    if (videoRef.current?.duration) {
      const dur = videoRef.current.duration;
      setMediaElementDuration(dur);

      // Calibrage temporel initial garanti dès que les métadonnées vidéo sont chargées
      if (!hasInitialSyncDoneRef.current) {
        hasInitialSyncDoneRef.current = true;
        const target = calculateReferenceTime({ ...player, duration: dur }, serverTimeOffset);
        if (target > 0) {
          pendingSeekRef.current = target;
          videoRef.current.currentTime = target;
          setCurrentTime(target);
        }
      }

      // Initialise les sous-titres YouTube si activés par l'utilisateur
      if (subtitlesEnabled) {
        try {
          const internal = (videoRef.current as any)?.getInternalPlayer?.();
          if (internal && typeof internal.loadModule === "function") {
            internal.loadModule("captions");
          }
        } catch {}
      }
    }
  }, [player, serverTimeOffset, subtitlesEnabled]);

  const onEnded = useCallback(() => {
    pendingSeekRef.current = null;
    const finalTime = duration > 0 ? duration : (videoRef.current?.duration || 0);
    setCurrentTime(finalTime);
    pauseIfPlaying(finalTime);
  }, [duration, pauseIfPlaying]);

  const onSeeked = useCallback(() => {
    pendingSeekRef.current = null;
  }, []);

  const onError = useCallback(() => {
    if (player.is_playing) {
      setNeedsAutoplayUnlock(true);
    } else {
      setHasError(true);
    }
  }, [player.is_playing]);

  return {
    videoRef,
    mediaUrl,
    provider: player.provider || "youtube",
    status,
    currentTime,
    duration,
    displayTime,
    roomTime,
    subtitlesEnabled,
    toggleSubtitles,
    isPiPSupported,
    isPiPActive,
    togglePictureInPicture,
    isBehind,
    needsAutoplayUnlock,
    isPlayDisabled,
    isSeekDisabled,
    volume,
    isMuted,
    setVolume,
    toggleMute,
    play,
    pause,
    togglePlay,
    replay,
    seek,
    catchUp,
    scrub,
    unlockAutoplay,
    playerProps: {
      onTimeUpdate,
      onDurationChange,
      onEnded,
      onError,
      onSeeked,
    },
  };
}

export const usePlayerController = usePlayer;
export default usePlayer;
