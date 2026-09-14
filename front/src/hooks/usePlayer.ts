import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { PlayerState } from "@/types/room";
import { PlaybackStatus } from "@/types/player";
import { calculateReferenceTime } from "@/lib/utils";
import {
  DESYNC_THRESHOLD_SECONDS,
  END_THRESHOLD_SECONDS,
  DOM_SYNC_DRIFT_THRESHOLD_SECONDS,
} from "@/lib/constants";
import { useVolume } from "./useVolume";

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
  videoRef: React.RefObject<HTMLVideoElement>;
  mediaUrl: string;
  provider?: string;
  status: PlaybackStatus;

  currentTime: number;
  duration: number;
  displayTime: number;
  roomTime: number;

  subtitlesEnabled: boolean;
  toggleSubtitles: () => void;
  isPiPSupported: boolean;
  isPiPActive: boolean;
  togglePictureInPicture: () => Promise<void>;

  isBehind: boolean;
  needsAutoplayUnlock: boolean;

  isPlayDisabled: boolean;
  isSeekDisabled: boolean;

  volume: number;
  isMuted: boolean;
  setVolume: (volume: number) => void;
  toggleMute: () => void;

  play: () => void;
  pause: () => void;
  togglePlay: () => void;
  replay: () => void;
  seek: (time: number) => void;
  catchUp: () => void;
  scrub: (time: number | null) => void;
  unlockAutoplay: () => void;

  playerProps: {
    onTimeUpdate: () => void;
    onDurationChange: () => void;
    onEnded: () => void;
    onError: () => void;
    onSeeked?: () => void;
  };
}

function isNearEnd(time: number, duration: number): boolean {
  return duration > 0 && time >= duration - END_THRESHOLD_SECONDS;
}

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
 * Hook central orchestrant le lecteur vidéo, la machine d'état et la synchronisation salon.
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
  const { volume, isMuted, setVolume, toggleMute } = useVolume(initialVolume);

  const mediaUrl = useMemo(
    () => resolveMediaUrl(player),
    [player.media_url, player.media_id, player.provider]
  );

  const [currentTime, setCurrentTime] = useState<number>(0);
  const [mediaElementDuration, setMediaElementDuration] = useState<number>(0);
  const [scrubbingTime, setScrubbingTime] = useState<number | null>(null);
  const [hasError, setHasError] = useState<boolean>(false);
  const [needsAutoplayUnlock, setNeedsAutoplayUnlock] = useState<boolean>(false);

  // Verrou temporel après un saut (seek/replay).
  // Absorbe les frames résiduelles du décodeur pendant 300ms sans heuristiques fragiles.
  const seekLockUntilRef = useRef<number>(0);
  const lastHandledUpdateRef = useRef<number>(player.last_updated_at);
  const hasInitialSyncDoneRef = useRef<boolean>(false);

  // Réinitialisation synchrone lors d'un changement d'URL (évite les cascades d'effets React)
  const [prevMediaUrl, setPrevMediaUrl] = useState<string>(mediaUrl);
  if (mediaUrl !== prevMediaUrl) {
    setPrevMediaUrl(mediaUrl);
    hasInitialSyncDoneRef.current = false;
    setCurrentTime(0);
    setMediaElementDuration(0);
    setScrubbingTime(null);
    hasError && setHasError(false);
    needsAutoplayUnlock && setNeedsAutoplayUnlock(false);
  }

  const duration = player.duration && player.duration > 0 ? player.duration : mediaElementDuration;
  const roomTime = calculateReferenceTime({ ...player, duration }, serverTimeOffset);

  // Machine d'état unifiée : statut dérivé sans redondance
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

  // Position affichée dans la timeline (verrouillée à 100% si terminé, priorité au scrubbing)
  const displayTime =
    scrubbingTime !== null ? scrubbingTime : status === "ended" && duration > 0 ? duration : currentTime;

  const isBehind =
    player.is_playing &&
    duration > 0 &&
    status !== "ended" &&
    !isNearEnd(roomTime, duration) &&
    scrubbingTime === null &&
    roomTime - currentTime > DESYNC_THRESHOLD_SECONDS;

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

  // Point unique et canonique de gestion de fin de média
  const handleMediaEnded = useCallback(() => {
    setCurrentTime(duration);
    if (player.is_playing && (!isRestrictedForGuest || duration > 0)) {
      sendPause(duration, duration);
    }
  }, [duration, player.is_playing, isRestrictedForGuest, sendPause]);

  // Synchronisation temporelle impérative avec les ordres du salon (DOM uniquement)
  useEffect(() => {
    if (lastHandledUpdateRef.current === player.last_updated_at) return;
    lastHandledUpdateRef.current = player.last_updated_at;

    const target = roomTime;
    setScrubbingTime(null);
    setCurrentTime(target);

    if (videoRef.current) {
      const local = videoRef.current.currentTime || 0;
      if (Math.abs(local - target) > DOM_SYNC_DRIFT_THRESHOLD_SECONDS) {
        seekLockUntilRef.current = Date.now() + 300;
        videoRef.current.currentTime = target;
      }
    }
  }, [player.last_updated_at, roomTime]);

  // Resynchronisation automatique au retour sur l'onglet si dérive (Page Visibility API)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState !== "visible" || !player.is_playing) return;

      const target = calculateReferenceTime({ ...player, duration }, serverTimeOffset);
      if (videoRef.current) {
        const local = videoRef.current.currentTime || 0;
        if (Math.abs(local - target) > DOM_SYNC_DRIFT_THRESHOLD_SECONDS) {
          seekLockUntilRef.current = Date.now() + 300;
          videoRef.current.currentTime = target;
          setCurrentTime(target);
        }
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [player, duration, serverTimeOffset]);

  // Heartbeat périodique vers le serveur (toutes les 2 secondes pendant la lecture)
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

  // Commandes de lecture
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
    seekLockUntilRef.current = Date.now() + 300;
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

      seekLockUntilRef.current = Date.now() + 300;
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
      } else if (atEnd) {
        handleMediaEnded();
      } else {
        sendSeek(clamped, duration);
      }
    },
    [isSeekDisabled, duration, status, handleMediaEnded, sendPlay, sendSeek]
  );

  const catchUp = useCallback(() => {
    setScrubbingTime(null);
    const safeTarget =
      duration > 0 ? Math.min(roomTime, Math.max(0, duration - END_THRESHOLD_SECONDS)) : roomTime;
    seekLockUntilRef.current = Date.now() + 300;
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

  // Sous-titres (mémorisation locale et pilotage API)
  const [subtitlesEnabled, setSubtitlesEnabled] = useState<boolean>(() => {
    return localStorage.getItem("synk_subtitles") === "true";
  });

  const toggleSubtitles = useCallback(() => {
    setSubtitlesEnabled((prev) => {
      const next = !prev;
      localStorage.setItem("synk_subtitles", String(next));

      try {
        const internal = (videoRef.current as any)?.getInternalPlayer?.();
        if (internal) {
          if (next && typeof internal.loadModule === "function") internal.loadModule("captions");
          if (!next && typeof internal.unloadModule === "function") internal.unloadModule("captions");
        }
      } catch (err) {
        console.warn("[SUBTITLES] YouTube captions error", err);
      }

      try {
        const videoEl =
          (videoRef.current as unknown as { getInternalPlayer?: () => HTMLVideoElement })
            .getInternalPlayer?.() || videoRef.current;
        if (videoEl?.textTracks) {
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

  // Mini-lecteur (Picture-in-Picture)
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
    } catch {}
  }, []);

  // Callbacks DOM pour ReactPlayer
  const onTimeUpdate = useCallback(() => {
    if (!videoRef.current || Date.now() < seekLockUntilRef.current) return;
    if (status === "ended") return;

    const cur = videoRef.current.currentTime;
    if (duration > 0 && cur >= duration - END_THRESHOLD_SECONDS) {
      handleMediaEnded();
      return;
    }

    setCurrentTime(cur);
  }, [duration, status, handleMediaEnded]);

  const onDurationChange = useCallback(() => {
    if (videoRef.current?.duration) {
      const dur = videoRef.current.duration;
      setMediaElementDuration(dur);

      if (!hasInitialSyncDoneRef.current) {
        hasInitialSyncDoneRef.current = true;
        const target = calculateReferenceTime({ ...player, duration: dur }, serverTimeOffset);
        if (target > 0) {
          seekLockUntilRef.current = Date.now() + 300;
          videoRef.current.currentTime = target;
          setCurrentTime(target);
        }
      }

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
    handleMediaEnded();
  }, [handleMediaEnded]);

  const onSeeked = useCallback(() => {}, []);

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
