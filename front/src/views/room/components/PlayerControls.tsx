import {
  Play,
  Pause,
  RotateCcw,
  Volume2,
  VolumeX,
  Lock,
  Unlock,
  Maximize,
  Minimize,
  Zap,
  Link2,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { RoomSettings } from "@/types/room";
import { formatTime } from "@/lib/utils";
import { PlayerController } from "@/hooks/usePlayerController";

interface PlayerControlsProps {
  controller: PlayerController;
  roomSettings: RoomSettings;
  isHost: boolean;
  volume?: number;
  isMuted?: boolean;
  isFullscreen?: boolean;
  isLockDisabled?: boolean;
  isChangeMediaDisabled?: boolean;
  onToggleLock: () => void;
  onChangeMedia?: () => void;
  onVolumeChange?: (volume: number) => void;
  onToggleMute?: () => void;
  onToggleFullscreen?: () => void;
}

export function PlayerControls({
  controller,
  roomSettings,
  isHost,
  volume = 100,
  isMuted = false,
  isFullscreen = false,
  isLockDisabled = false,
  isChangeMediaDisabled = false,
  onToggleLock,
  onChangeMedia,
  onVolumeChange,
  onToggleMute,
  onToggleFullscreen,
}: PlayerControlsProps) {
  const { t } = useTranslation("room");
  const {
    duration,
    displayTime,
    status,
    isBehind,
    isPlayDisabled,
    isSeekDisabled,
    togglePlay,
    catchUp,
    scrub,
    seek,
  } = controller;

  const isAtEnd = status === "ended";

  return (
    <div className="w-full max-w-4xl bg-[#141417]/90 backdrop-blur-md border border-white/10 rounded-xl p-3.5 sm:p-4 flex flex-col gap-3 select-none mt-3 shadow-lg relative z-10">
      {/* Barre de défilement (Timeline) */}
      <div className="w-full flex items-center gap-3">
        <span className="text-xs font-mono text-zinc-400 min-w-10">
          {formatTime(displayTime)}
        </span>

        <div className="flex-1">
          <Slider
            value={[Math.min(displayTime, duration > 0 ? duration : 0)]}
            max={duration > 0 ? duration : 100}
            step={1}
            disabled={isSeekDisabled}
            onValueChange={([val]) => scrub(val)}
            onValueCommit={([val]) => seek(val)}
          />
        </div>

        <span className="text-xs font-mono text-zinc-600">
          {formatTime(duration)}
        </span>
      </div>

      {/* Barre d'actions */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {/* Lecture / Pause / Replay unifié */}
          <Button
            variant={isAtEnd ? "teal" : status === "playing" ? "secondary" : "teal"}
            size="icon"
            disabled={isPlayDisabled}
            onClick={togglePlay}
          >
            {isAtEnd ? (
              <RotateCcw className="w-4 h-4" />
            ) : status === "playing" ? (
              <Pause className="w-4 h-4 text-[#0ac8b9]" />
            ) : (
              <Play className="w-4 h-4 fill-current" />
            )}
          </Button>

          <div className="h-5 w-px bg-white/5" />

          {/* Réglage du Volume */}
          <div className="flex items-center gap-2 px-2.5 py-1 bg-black/40 border border-white/5 text-xs font-mono rounded-lg">
            <button
              type="button"
              onClick={onToggleMute}
              className="text-zinc-400 hover:text-white transition-colors cursor-pointer"
              title={isMuted ? t("controls.unmute") : t("controls.mute")}
            >
              {isMuted || volume === 0 ? (
                <VolumeX className="w-3.5 h-3.5 text-rose-400" />
              ) : (
                <Volume2 className="w-3.5 h-3.5 text-zinc-300" />
              )}
            </button>
            <div className="w-16 sm:w-20">
              <Slider
                value={[isMuted ? 0 : volume]}
                max={100}
                step={1}
                onValueChange={([val]) => {
                  onVolumeChange?.(val);
                  if (isMuted && val > 0) onToggleMute?.();
                }}
              />
            </div>
            <span className="min-w-[28px] text-[11px] text-zinc-400 select-none">
              {isMuted ? "0%" : `${volume}%`}
            </span>
          </div>

          {/* Bouton Rattraper (visible uniquement si retard > 3s) */}
          {isBehind && (
            <Button
              variant="outline"
              size="sm"
              disabled={isSeekDisabled}
              onClick={catchUp}
              className="text-[#0ac8b9] border-[#0ac8b9]/40 hover:bg-[#0ac8b9]/10 gap-1.5 h-8 px-2.5 text-xs font-mono transition-all animate-in fade-in duration-150 cursor-pointer"
              title={t("controls.catchUp")}
            >
              <Zap className="w-3.5 h-3.5 fill-current" />
              <span>{t("controls.catchUp")}</span>
            </Button>
          )}
        </div>

        {/* Côté Droit : Changement de média, Verrou d'hôte & Plein écran */}
        <div className="flex items-center gap-2">
          {onChangeMedia && (
            <Button
              variant="secondary"
              size="sm"
              disabled={isChangeMediaDisabled}
              onClick={onChangeMedia}
              className="gap-1.5 h-8 px-2.5 text-xs text-zinc-300 hover:text-white"
              title={`${t("controls.changeMedia")} (⌘K)`}
            >
              <Link2 className="w-3.5 h-3.5 text-[#0ac8b9]" />
              <span className="hidden sm:inline">{t("controls.changeMedia")}</span>
              <kbd className="hidden md:inline-block px-1 py-0.5 bg-black/40 border border-white/10 rounded text-[9px] font-mono text-zinc-400">
                ⌘K
              </kbd>
            </Button>
          )}

          {isHost ? (
            <Button
              variant={roomSettings.is_locked ? "destructive" : "secondary"}
              size="sm"
              disabled={isLockDisabled}
              onClick={onToggleLock}
              className="gap-1.5"
            >
              {roomSettings.is_locked ? (
                <Lock className="w-3.5 h-3.5" />
              ) : (
                <Unlock className="w-3.5 h-3.5" />
              )}
              <span>
                {roomSettings.is_locked
                  ? t("controls.roomLocked")
                  : t("controls.roomUnlocked")}
              </span>
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
              title={
                isFullscreen
                  ? t("controls.exitFullscreen")
                  : t("controls.fullscreen")
              }
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
