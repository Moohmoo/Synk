import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { PlayerState } from "@/types/room";
import { calculateReferenceTime } from "@/lib/utils";
import { DESYNC_THRESHOLD_SECONDS } from "@/lib/constants";

export interface UseRoomPlayerOptions {
  player: PlayerState;
  isHost: boolean;
  isLocked: boolean;
  isRateLimited?: (action: string) => boolean;
  sendPlay: (currentTime?: number, duration?: number) => void;
  sendPause: (currentTime?: number, duration?: number) => void;
  sendSeek: (targetTime: number, duration?: number) => void;
}

export interface RoomPlayerController {
  videoRef: React.RefObject<HTMLVideoElement>;
  mediaUrl: string;

  // Temps et durée (Source de vérité unifiée)
  currentTime: number;
  duration: number;
  displayTime: number;
  scrubbingTime: number | null;

  // États du lecteur
  isPlaying: boolean;
  isEnded: boolean;
  isBehind: boolean;
  needsAutoplayUnlock: boolean;
  hasError: boolean;

  // Permissions & Rate-limiting
  isPlayDisabled: boolean;
  isSeekDisabled: boolean;

  // Actions utilisateur
  togglePlay: () => void;
  seek: (targetTime: number) => void;
  catchUp: () => void;
  startScrubbing: (time: number) => void;
  commitScrubbing: (time: number) => void;
  unlockAutoplay: () => void;

  // Événements multimédias
  onTimeUpdate: () => void;
  onDurationChange: (duration: number) => void;
  onEnded: () => void;
  onError: () => void;
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
 * Contrôleur unifié du lecteur vidéo et de la synchronisation en salon.
 * Élimine l'éparpillement des variables de durée et de timing.
 */
export function useRoomPlayer({
  player,
  isHost,
  isLocked,
  isRateLimited,
  sendPlay,
  sendPause,
  sendSeek,
}: UseRoomPlayerOptions): RoomPlayerController {
  const videoRef = useRef<HTMLVideoElement>(null);

  const [currentTime, setCurrentTime] = useState<number>(0);
  const [internalDuration, setInternalDuration] = useState<number>(0);
  const [scrubbingTime, setScrubbingTime] = useState<number | null>(null);
  const [isLocallyEnded, setIsLocallyEnded] = useState<boolean>(false);
  const [needsAutoplayUnlock, setNeedsAutoplayUnlock] = useState<boolean>(false);
  const [hasError, setHasError] = useState<boolean>(false);

  const lastHandledUpdateRef = useRef<number>(player.last_updated_at);

  const mediaUrl = useMemo(() => resolveMediaUrl(player), [
    player.media_url,
    player.media_id,
    player.provider,
  ]);

  // Durée unifiée : durée salon si connue, sinon durée détectée par l'élément vidéo
  const duration = player.duration && player.duration > 0 ? player.duration : internalDuration;

  // Position affichée (priorité au curseur de scrubbing en cours)
  const displayTime = scrubbingTime !== null ? scrubbingTime : currentTime;

  // Statut de fin de média
  const isEnded = isLocallyEnded || (duration > 0 && currentTime >= duration - 0.5);

  // Position théorique du salon
  const roomTime = calculateReferenceTime({ ...player, duration });
  const isRoomAtEnd = duration > 0 && roomTime >= duration - 0.5;

  // Détection de désynchronisation (Rattrapage requis)
  const isBehind =
    player.is_playing &&
    duration > 0 &&
    !isEnded &&
    !isRoomAtEnd &&
    scrubbingTime === null &&
    roomTime - currentTime > DESYNC_THRESHOLD_SECONDS;

  // Restriction d'actions pour les invités si le salon est verrouillé ou rate-limited
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
    setInternalDuration(0);
    setScrubbingTime(null);
  }, [mediaUrl]);

  // Synchronisation avec les ordres officiels du salon (PLAY, PAUSE, SEEK, REPLAY)
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

  // Actions
  const togglePlay = useCallback(() => {
    if (isPlayDisabled) return;

    if (isEnded) {
      if (videoRef.current) videoRef.current.currentTime = 0;
      setCurrentTime(0);
      setIsLocallyEnded(false);
      sendPlay(0, duration);
      return;
    }

    if (player.is_playing) {
      sendPause(currentTime, duration);
    } else {
      sendPlay(currentTime, duration);
    }
  }, [isPlayDisabled, isEnded, player.is_playing, currentTime, duration, sendPlay, sendPause]);

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

  const startScrubbing = useCallback((time: number) => {
    setScrubbingTime(time);
  }, []);

  const commitScrubbing = useCallback(
    (time: number) => {
      seek(time);
      setScrubbingTime(null);
    },
    [seek]
  );

  const unlockAutoplay = useCallback(() => {
    if (videoRef.current) {
      videoRef.current
        .play()
        .then(() => setNeedsAutoplayUnlock(false))
        .catch(() => {});
    }
  }, []);

  // Événements média DOM
  const onTimeUpdate = useCallback(() => {
    if (!videoRef.current || isLocallyEnded) return;
    const cur = videoRef.current.currentTime;
    if (duration > 0 && cur >= duration - 0.5) {
      setIsLocallyEnded(true);
      setCurrentTime(duration);
      if (player.is_playing && !isRestrictedForGuest && !isRateLimited?.("PAUSE")) {
        sendPause(duration, duration);
      }
      return;
    }
    setCurrentTime(cur);
  }, [isLocallyEnded, duration, player.is_playing, isRestrictedForGuest, isRateLimited, sendPause]);

  const onDurationChange = useCallback((dur: number) => {
    if (dur > 0) {
      setInternalDuration(dur);
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
    currentTime,
    duration,
    displayTime,
    scrubbingTime,
    isPlaying: player.is_playing,
    isEnded,
    isBehind,
    needsAutoplayUnlock,
    hasError,
    isPlayDisabled,
    isSeekDisabled,
    togglePlay,
    seek,
    catchUp,
    startScrubbing,
    commitScrubbing,
    unlockAutoplay,
    onTimeUpdate,
    onDurationChange,
    onEnded,
    onError,
  };
}
