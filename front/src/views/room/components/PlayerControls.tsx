import { useState, useEffect, useRef } from "react";
import {
  Play,
  Pause,
  RotateCcw,
  Volume2,
  Volume1,
  VolumeX,
  Lock,
  Unlock,
  Maximize,
  Minimize,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { PlayerState, RoomSettings } from "@/types/room";
import { useInterpolatedTime } from "@/hooks/useInterpolatedTime";
import { useActionCooldown } from "@/hooks/useActionCooldown";

interface PlayerControlsProps {
  player: PlayerState;
  roomSettings: RoomSettings;
  isHost: boolean;
  duration?: number;
  volume?: number;
  isMuted?: boolean;
  isFullscreen?: boolean;
  onPlay: (time?: number) => void;
  onPause: (time?: number) => void;
  onSeek: (time: number) => void;
  onToggleLock: () => void;
  onVolumeChange?: (volume: number) => void;
  onToggleMute?: () => void;
  onToggleFullscreen?: () => void;
}

export function PlayerControls({
  player,
  roomSettings,
  isHost,
  duration = 0,
  volume = 100,
  isMuted = false,
  isFullscreen = false,
  onPlay,
  onPause,
  onSeek,
  onToggleLock,
  onVolumeChange,
  onToggleMute,
  onToggleFullscreen,
}: PlayerControlsProps) {
  const { t } = useTranslation("room");
  const isLockedForGuest = roomSettings.is_locked && !isHost;
  const [scrubbingTime, setScrubbingTime] = useState<number | null>(null);
  const [pendingSeekTime, setPendingSeekTime] = useState<number | null>(null);
  const pendingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isScrubbing = scrubbingTime !== null;

  // Anti-spam & Cooldown sur les interactions critiques vers le serveur
  const [throttledToggleLock, isLockCooldown] = useActionCooldown(onToggleLock, 450);
  const [throttledPlay, isPlayCooldown] = useActionCooldown(onPlay, 350);
  const [throttledPause, isPauseCooldown] = useActionCooldown(onPause, 350);
  const [throttledSeek, isSeekCooldown] = useActionCooldown(onSeek, 300);
  const isPlaybackCooldown = isPlayCooldown || isPauseCooldown;

  // Libérer le maintien optimiste dès confirmation du serveur (acquittement WebSocket)
  useEffect(() => {
    if (pendingSeekTime !== null) {
      setPendingSeekTime(null);
      if (pendingTimerRef.current) {
        clearTimeout(pendingTimerRef.current);
        pendingTimerRef.current = null;
      }
    }
  }, [player.last_updated_at, player.current_time]);

  useEffect(() => {
    return () => {
      if (pendingTimerRef.current) {
        clearTimeout(pendingTimerRef.current);
      }
    };
  }, []);

  const formatTime = (seconds: number) => {
    if (!seconds || isNaN(seconds) || seconds < 0) return "0:00";
    const totalSecs = Math.floor(seconds);
    const hrs = Math.floor(totalSecs / 3600);
    const mins = Math.floor((totalSecs % 3600) / 60);
    const secs = totalSecs % 60;
    if (hrs > 0) {
      return `${hrs}:${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
    }
    return `${mins}:${String(secs).padStart(2, "0")}`;
  };

  const totalDuration = duration > 0 ? duration : (player.duration || 0);

  const interpolatedTime = useInterpolatedTime({
    player,
    duration: totalDuration,
    isScrubbing: isScrubbing || pendingSeekTime !== null,
  });

  // Maintien optimiste : priorité au scrubbing local, puis au seek en attente de validation serveur, puis à l'interpolation
  const displayTime = isScrubbing
    ? scrubbingTime
    : pendingSeekTime !== null
    ? pendingSeekTime
    : interpolatedTime;
  const isTimelineDisabled = isLockedForGuest || totalDuration === 0 || !player.media_id;
  const isAtEnd = totalDuration > 0 && displayTime >= Math.max(0, totalDuration - 0.5);

  return (
    <div className="w-full max-w-4xl bg-[#141417]/90 backdrop-blur-md border border-white/10 rounded-xl p-3.5 sm:p-4 flex flex-col gap-3 select-none mt-3 shadow-lg relative z-10">
      {/* Timeline Seek Bar */}
      <div className="w-full flex items-center gap-3">
        <span className="text-xs font-mono text-zinc-400 min-w-10">
          {formatTime(displayTime)}
        </span>

        <div className="flex-1">
          <Slider
            value={[Math.min(displayTime, totalDuration > 0 ? totalDuration : 0)]}
            max={totalDuration > 0 ? totalDuration : 100}
            step={1}
            disabled={isTimelineDisabled}
            onValueChange={(val) => {
              if (val.length > 0) {
                setScrubbingTime(val[0]);
              }
            }}
            onValueCommit={(val) => {
              if (val.length > 0) {
                const target = val[0];
                setPendingSeekTime(target);
                throttledSeek(target);
                setScrubbingTime(null);

                // Filet de sécurité maximal : libérer après 1s si aucune réponse réseau
                if (pendingTimerRef.current) {
                  clearTimeout(pendingTimerRef.current);
                }
                pendingTimerRef.current = setTimeout(() => {
                  setPendingSeekTime(null);
                }, 1000);
              }
            }}
          />
        </div>

        <span className="text-xs font-mono text-zinc-600">
          {formatTime(totalDuration)}
        </span>
      </div>

      {/* Action Toolbar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {player.is_playing ? (
            <Button
              variant="secondary"
              size="icon"
              disabled={isLockedForGuest || !player.media_id || isPlaybackCooldown}
              onClick={() => throttledPause(displayTime)}
              className="text-[#0ac8b9]"
              title={t("controls.pause")}
            >
              <Pause className="w-4 h-4" />
            </Button>
          ) : (
            <Button
              variant="teal"
              size="icon"
              disabled={isLockedForGuest || !player.media_id || isPlaybackCooldown}
              onClick={() => throttledPlay(isAtEnd ? 0 : displayTime)}
              title={isAtEnd ? t("controls.replay", { defaultValue: "Rejouer" }) : t("controls.play")}
            >
              {isAtEnd ? (
                <RotateCcw className="w-4 h-4" />
              ) : (
                <Play className="w-4 h-4 fill-current" />
              )}
            </Button>
          )}

          <Button
            variant="secondary"
            size="icon"
            disabled={
              isLockedForGuest ||
              !player.media_id ||
              isSeekCooldown ||
              (player.current_time === 0 && !player.is_playing)
            }
            onClick={() => throttledSeek(0)}
            title={t("controls.rewind")}
          >
            <RotateCcw className="w-4 h-4 text-zinc-400" />
          </Button>

          <div className="h-5 w-px bg-white/5 mx-1" />

          {/* Volume Control Interactif (Purement Local) */}
          <div className="flex items-center gap-2 px-2.5 py-1 bg-black/40 border border-white/5 text-xs font-mono rounded-lg">
            <button
              type="button"
              onClick={onToggleMute}
              className="text-zinc-400 hover:text-white transition-colors cursor-pointer"
              title={isMuted ? t("controls.unmute") : t("controls.mute")}
            >
              {isMuted || volume === 0 ? (
                <VolumeX className="w-3.5 h-3.5 text-rose-400" />
              ) : volume < 50 ? (
                <Volume1 className="w-3.5 h-3.5 text-zinc-300" />
              ) : (
                <Volume2 className="w-3.5 h-3.5 text-zinc-300" />
              )}
            </button>
            <div className="w-16 sm:w-20">
              <Slider
                value={[isMuted ? 0 : volume]}
                max={100}
                step={1}
                onValueChange={(val) => {
                  if (val.length > 0 && onVolumeChange) {
                    onVolumeChange(val[0]);
                    if (isMuted && val[0] > 0 && onToggleMute) {
                      onToggleMute();
                    }
                  }
                }}
              />
            </div>
            <span className="min-w-[28px] text-[11px] text-zinc-400 select-none">
              {isMuted ? "0%" : `${volume}%`}
            </span>
          </div>
        </div>

        {/* Contrôles Côté Droit : Verrou d'hôte & Plein écran */}
        <div className="flex items-center gap-2">
          {isHost ? (
            <Button
              variant={roomSettings.is_locked ? "destructive" : "secondary"}
              size="sm"
              onClick={throttledToggleLock}
              disabled={isLockCooldown}
              className="gap-1.5"
            >
              {roomSettings.is_locked ? (
                <>
                  <Lock className="w-3.5 h-3.5" />
                  <span>{t("controls.roomLocked")}</span>
                </>
              ) : (
                <>
                  <Unlock className="w-3.5 h-3.5" />
                  <span>{t("controls.roomUnlocked")}</span>
                </>
              )}
            </Button>
          ) : (
            roomSettings.is_locked && (
              <div className="flex items-center gap-1.5 px-2.5 py-1 bg-black/40 border border-white/5 text-[11px] font-sans tracking-wider text-amber-400 uppercase">
                <Lock className="w-3 h-3" />
                <span>{t("controls.hostOnly")}</span>
              </div>
            )
          )}

          {onToggleFullscreen && (
            <Button
              variant="secondary"
              size="icon"
              onClick={onToggleFullscreen}
              title={isFullscreen ? t("controls.exitFullscreen") : t("controls.fullscreen")}
              className="h-8 w-8 text-zinc-400 hover:text-white"
            >
              {isFullscreen ? (
                <Minimize className="w-3.5 h-3.5" />
              ) : (
                <Maximize className="w-3.5 h-3.5" />
              )}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
