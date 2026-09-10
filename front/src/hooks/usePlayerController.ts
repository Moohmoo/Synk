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

export interface UsePlayerControllerOptions {
  player: PlayerState;
  isHost: boolean;
  isLocked: boolean;
  isRateLimited?: (action: string) => boolean;
  sendPlay: (currentTime?: number, duration?: number, isRestart?: boolean) => void;
  sendPause: (currentTime?: number, duration?: number) => void;
  sendSeek: (targetTime: number, duration?: number) => void;
}

export interface PlayerController {
  // Référence DOM vers le lecteur vidéo
  videoRef: React.RefObject<HTMLVideoElement>;

  // Source média résolue
  mediaUrl: string;

  // Machine d'état unifiée (remplace la forêt de booléens)
  status: PlaybackStatus;

  // Position et Durée (Uniques sources de vérité)
  currentTime: number;
  duration: number;
  displayTime: number;

  // Détection de retard (Bouton Rattraper)
  isBehind: boolean;
  needsAutoplayUnlock: boolean;

  // Permissions & Limiteurs de débit
  isPlayDisabled: boolean;
  isSeekDisabled: boolean;

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
 * Hook central orchestrant le lecteur vidéo, la machine à états et la synchronisation salon.
 */
export function usePlayerController({
  player,
  isHost,
  isLocked,
  isRateLimited,
  sendPlay,
  sendPause,
  sendSeek,
}: UsePlayerControllerOptions): PlayerController {
  const videoRef = useRef<HTMLVideoElement>(null);

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

  // Réinitialisation synchrone pendant le render lors d'un changement d'URL
  // (Pattern React recommandé évitant les cascades de re-renders dues à un useEffect)
  const [prevMediaUrl, setPrevMediaUrl] = useState<string>(mediaUrl);
  if (mediaUrl !== prevMediaUrl) {
    setPrevMediaUrl(mediaUrl);
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

  // Position théorique du salon
  const roomTime = calculateReferenceTime({ ...player, duration });

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
      if (player.is_playing && !isRestrictedForGuest && !isRateLimited?.("PAUSE")) {
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
      if (Math.abs(local - target) > DOM_SYNC_DRIFT_THRESHOLD_SECONDS) {
        pendingSeekRef.current = target;
        videoRef.current.currentTime = target;
      }
    }
  }, [player.last_updated_at, roomTime]);

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

      if (atEnd && player.is_playing) {
        pauseIfPlaying(clamped);
      } else {
        sendSeek(clamped, duration);
      }
    },
    [isSeekDisabled, duration, player.is_playing, pauseIfPlaying, sendSeek]
  );

  const catchUp = useCallback(() => {
    const safeTarget =
      duration > 0 ? Math.min(roomTime, Math.max(0, duration - END_THRESHOLD_SECONDS)) : roomTime;
    seek(safeTarget);
  }, [duration, roomTime, seek]);

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

  // Callbacks DOM pour ReactPlayer
  const onTimeUpdate = useCallback(() => {
    if (!videoRef.current) return;
    const cur = videoRef.current.currentTime;

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
    // Évite le saut à 0 lorsque le lecteur boucle ou bufferise en toute fin
    if (cur === 0 && duration > 2 && currentTime >= duration - 1) return;
    setCurrentTime(cur);
  }, [duration, currentTime, pauseIfPlaying]);

  const onDurationChange = useCallback(() => {
    if (videoRef.current?.duration) {
      setMediaElementDuration(videoRef.current.duration);
    }
  }, []);

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
    status,
    currentTime,
    duration,
    displayTime,
    isBehind,
    needsAutoplayUnlock,
    isPlayDisabled,
    isSeekDisabled,
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
