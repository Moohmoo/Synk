import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { PlayerState } from "@/types/room";
import { calculateReferenceTime } from "@/lib/utils";
import { DESYNC_THRESHOLD_SECONDS } from "@/lib/constants";

export type PlaybackStatus = "idle" | "playing" | "paused" | "ended" | "buffering" | "error";

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
  };
}

function resolveMediaUrl(player: PlayerState): string {
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

  // États locaux de lecture
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [mediaElementDuration, setMediaElementDuration] = useState<number>(0);
  const [scrubbingTime, setScrubbingTime] = useState<number | null>(null);
  const [isLocallyEnded, setIsLocallyEnded] = useState<boolean>(false);
  const [needsAutoplayUnlock, setNeedsAutoplayUnlock] = useState<boolean>(false);
  const [hasError, setHasError] = useState<boolean>(false);

  const lastHandledUpdateRef = useRef<number>(player.last_updated_at);

  const mediaUrl = useMemo(
    () => resolveMediaUrl(player),
    [player.media_url, player.media_id, player.provider]
  );

  // Durée unifiée (priorité au serveur, repli sur la durée détectée par l'élément vidéo)
  const duration = player.duration && player.duration > 0 ? player.duration : mediaElementDuration;

  // Position affichée dans la timeline (priorité au déplacement du slider)
  const displayTime = scrubbingTime !== null ? scrubbingTime : currentTime;

  // Position théorique du salon
  const roomTime = calculateReferenceTime({ ...player, duration });
  const isRoomAtEnd = duration > 0 && roomTime >= duration - 0.5;

  // Machine d'état unifiée : un seul statut exclusif
  const status: PlaybackStatus = useMemo(() => {
    if (!mediaUrl) return "idle";
    if (hasError) return "error";
    if (isLocallyEnded || (duration > 0 && currentTime >= duration - 0.5)) return "ended";
    if (player.is_playing) return "playing";
    return "paused";
  }, [mediaUrl, hasError, isLocallyEnded, duration, currentTime, player.is_playing]);

  // Détection de désynchronisation : en retard de plus de 3s par rapport au salon
  const isBehind =
    player.is_playing &&
    duration > 0 &&
    status !== "ended" &&
    !isRoomAtEnd &&
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

  // Réinitialisation lors du changement d'URL
  useEffect(() => {
    setHasError(false);
    setNeedsAutoplayUnlock(false);
    setIsLocallyEnded(false);
    setCurrentTime(0);
    setMediaElementDuration(0);
    setScrubbingTime(null);
  }, [mediaUrl]);

  // Synchronisation temporelle avec les ordres du salon (PLAY, PAUSE, SEEK, ROLLBACK)
  useEffect(() => {
    if (lastHandledUpdateRef.current === player.last_updated_at) return;
    lastHandledUpdateRef.current = player.last_updated_at;

    setIsLocallyEnded(false);

    if (!videoRef.current) return;
    const local = videoRef.current.currentTime || 0;
    const target = calculateReferenceTime(player);
    if (Math.abs(local - target) > 0.5) {
      videoRef.current.currentTime = target;
      setCurrentTime(target);
    }
  }, [player.last_updated_at, player.current_time, player.is_playing]);

  // Commandes explicites
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
    if (videoRef.current) {
      videoRef.current.currentTime = 0;
    }
    setCurrentTime(0);
    setIsLocallyEnded(false);
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
      if (isSeekDisabled) return;
      const clamped =
        duration > 0 ? Math.min(Math.max(0, targetTime), duration) : Math.max(0, targetTime);
      if (videoRef.current) {
        videoRef.current.currentTime = clamped;
      }
      setCurrentTime(clamped);
      setIsLocallyEnded(false);
      sendSeek(clamped, duration);
    },
    [isSeekDisabled, duration, sendSeek]
  );

  const catchUp = useCallback(() => {
    const safeTarget =
      duration > 0 ? Math.min(roomTime, Math.max(0, duration - 0.5)) : roomTime;
    seek(safeTarget);
  }, [duration, roomTime, seek]);

  const scrub = useCallback(
    (time: number | null) => {
      setScrubbingTime(time);
    },
    []
  );

  const unlockAutoplay = useCallback(() => {
    if (videoRef.current) {
      videoRef.current
        .play()
        .then(() => setNeedsAutoplayUnlock(false))
        .catch(() => {});
    }
  }, []);

  // Callbacks DOM pour ReactPlayer
  const onTimeUpdate = useCallback(() => {
    if (!videoRef.current || isLocallyEnded || scrubbingTime !== null) return;
    const cur = videoRef.current.currentTime;
    setCurrentTime(cur);
  }, [isLocallyEnded, scrubbingTime]);

  const onDurationChange = useCallback(() => {
    if (videoRef.current?.duration) {
      setMediaElementDuration(videoRef.current.duration);
    }
  }, []);

  const onEnded = useCallback(() => {
    setIsLocallyEnded(true);
    const finalTime = duration > 0 ? duration : (videoRef.current?.duration || 0);
    setCurrentTime(finalTime);
    if (player.is_playing && !isRestrictedForGuest && !isRateLimited?.("PAUSE")) {
      sendPause(finalTime, duration);
    }
  }, [duration, player.is_playing, isRestrictedForGuest, isRateLimited, sendPause]);

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
    },
  };
}
