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

interface VolumeControlProps {
  volume: number;
  isMuted: boolean;
  onVolumeChange?: (volume: number) => void;
  onToggleMute?: () => void;
  muteLabel: string;
  unmuteLabel: string;
}

/**
 * Contrôle du volume sonore :
 * - Sur mobile : bouton discret de bascule muet/sonore adapté au contrôle tactile.
 * - Sur desktop : slider horizontal et indicateur numérique en pourcentage.
 */
function VolumeControl({
  volume,
  isMuted,
  onVolumeChange,
  onToggleMute,
  muteLabel,
  unmuteLabel,
}: VolumeControlProps) {
  return (
    <div className="flex items-center gap-1.5 sm:gap-2 px-2 sm:px-2.5 py-1 bg-black/40 border border-white/5 text-xs font-mono rounded-sm">
      <button
        type="button"
        onClick={onToggleMute}
        className="text-zinc-400 hover:text-white transition-colors cursor-pointer"
        title={isMuted ? unmuteLabel : muteLabel}
      >
        {isMuted || volume === 0 ? (
          <VolumeX className="w-3.5 h-3.5 text-rose-400" />
        ) : (
          <Volume2 className="w-3.5 h-3.5 text-zinc-300" />
        )}
      </button>
      <div className="hidden sm:block w-16 sm:w-20">
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
      <span className="hidden sm:inline min-w-[28px] text-[11px] text-zinc-400 select-none">
        {isMuted ? "0%" : `${volume}%`}
      </span>
    </div>
  );
}

interface RoomLockButtonProps {
  isHost: boolean;
  isLocked: boolean;
  isDisabled: boolean;
  onToggleLock: () => void;
  hostOnlyLabel: string;
  lockedLabel: string;
  unlockedLabel: string;
}

/**
 * Bouton de verrouillage du salon :
 * - Pour l'hôte : bouton d'action pour basculer le verrouillage exclusif.
 * - Pour les invités : badge informatif discret si le salon est verrouillé.
 */
function RoomLockButton({
  isHost,
  isLocked,
  isDisabled,
  onToggleLock,
  hostOnlyLabel,
  lockedLabel,
  unlockedLabel,
}: RoomLockButtonProps) {
  if (isHost) {
    return (
      <Button
        variant={isLocked ? "destructive" : "secondary"}
        size="sm"
        disabled={isDisabled}
        onClick={onToggleLock}
        className="gap-1.5 h-8 px-2.5 sm:px-3 text-xs"
        title={isLocked ? lockedLabel : unlockedLabel}
      >
        {isLocked ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
        <span className="hidden sm:inline">{isLocked ? lockedLabel : unlockedLabel}</span>
      </Button>
    );
  }

  if (isLocked) {
    return (
      <div
        className="flex items-center gap-1.5 px-2 sm:px-2.5 py-1 bg-black/40 border border-white/5 text-[11px] font-sans tracking-wider text-amber-400 uppercase rounded-sm"
        title={hostOnlyLabel}
      >
        <Lock className="w-3 h-3" />
        <span className="hidden sm:inline">{hostOnlyLabel}</span>
      </div>
    );
  }

  return null;
}

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
    <div className="w-full max-w-4xl bg-[#141417]/90 backdrop-blur-md border border-white/10 rounded-sm p-2.5 sm:p-4 flex flex-col gap-2.5 sm:gap-3 select-none mt-3 shadow-lg relative z-10">
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
        <div className="flex items-center gap-2 sm:gap-3">
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
          <VolumeControl
            volume={volume}
            isMuted={isMuted}
            onVolumeChange={onVolumeChange}
            onToggleMute={onToggleMute}
            muteLabel={t("controls.mute")}
            unmuteLabel={t("controls.unmute")}
          />

          {/* Bouton Rattraper */}
          {isBehind && (
            <Button
              variant="outline"
              size="sm"
              disabled={isSeekDisabled}
              onClick={catchUp}
              className="text-[#0ac8b9] border-[#0ac8b9]/40 hover:bg-[#0ac8b9]/10 gap-1.5 h-8 px-2 sm:px-2.5 text-xs font-mono transition-all animate-in fade-in duration-150 cursor-pointer"
              title={t("controls.catchUp")}
            >
              <Zap className="w-3.5 h-3.5 fill-current" />
              <span className="hidden sm:inline">{t("controls.catchUp")}</span>
            </Button>
          )}
        </div>

        {/* Côté Droit : Changement de média, Verrou d'hôte & Plein écran */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          {onChangeMedia && (
            <Button
              variant="secondary"
              size="sm"
              disabled={isChangeMediaDisabled}
              onClick={onChangeMedia}
              className="gap-1.5 h-8 px-2 sm:px-2.5 text-xs text-zinc-300 hover:text-white"
              title={t("controls.changeMedia")}
            >
              <Link2 className="w-3.5 h-3.5 text-[#0ac8b9]" />
              <span className="hidden sm:inline">{t("controls.changeMedia")}</span>
            </Button>
          )}

          {/* Verrou d'hôte */}
          <RoomLockButton
            isHost={isHost}
            isLocked={roomSettings.is_locked}
            isDisabled={isLockDisabled}
            onToggleLock={onToggleLock}
            hostOnlyLabel={t("controls.hostOnly")}
            lockedLabel={t("controls.roomLocked")}
            unlockedLabel={t("controls.roomUnlocked")}
          />

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
