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
import { Slider } from "@/components/ui/slider";
import { RoomSettings } from "@/types/room";
import { formatTime, cn } from "@/lib/utils";
import { PlayerController } from "@/hooks/usePlayer";
import { PlayerSettingsMenu } from "./PlayerSettingsMenu";

interface PlayerControlsProps {
  controller: PlayerController;
  roomSettings: RoomSettings;
  isHost: boolean;
  ping?: number;
  volume?: number;
  isMuted?: boolean;
  isFullscreen?: boolean;
  areControlsVisible?: boolean;
  isLockDisabled?: boolean;
  isChangeMediaDisabled?: boolean;
  onToggleLock: () => void;
  onChangeMedia?: () => void;
  onVolumeChange?: (volume: number) => void;
  onToggleMute?: () => void;
  onToggleFullscreen?: () => void;
}

/**
 * Barre de contrôles de lecture superposée (overlay) au lecteur vidéo.
 */
export function PlayerControls({
  controller,
  roomSettings,
  isHost,
  ping,
  volume,
  isMuted,
  isFullscreen = false,
  areControlsVisible = true,
  isLockDisabled = false,
  isChangeMediaDisabled = false,
  onToggleLock,
  onChangeMedia,
  onVolumeChange,
  onToggleMute,
  onToggleFullscreen,
}: PlayerControlsProps) {
  const { t } = useTranslation("room");
  const effectiveVolume = volume ?? controller.volume;
  const effectiveMuted = isMuted ?? controller.isMuted;
  const handleVolumeChange = onVolumeChange ?? controller.setVolume;
  const handleToggleMute = onToggleMute ?? controller.toggleMute;
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
    <div
      className={cn(
        "absolute bottom-0 inset-x-0 z-20 bg-gradient-to-t from-black/85 via-black/30 to-transparent px-4 pb-3 pt-8 flex flex-col gap-1.5 select-none transition-opacity duration-300",
        areControlsVisible
          ? "opacity-100 pointer-events-auto"
          : "opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto"
      )}
    >
      {/* 1. TIMELINE : Ligne pleine sur toute la largeur */}
      <div className="w-full group/timeline py-1">
        <Slider
          value={[Math.min(displayTime, duration > 0 ? duration : 0)]}
          max={duration > 0 ? duration : 100}
          step={1}
          disabled={isSeekDisabled}
          onValueChange={([val]) => scrub(val)}
          onValueCommit={([val]) => seek(val)}
          className="cursor-pointer py-1"
          trackClassName="h-1 group-hover/timeline:h-1.5 transition-all bg-white/20 rounded-full cursor-pointer"
          rangeClassName="bg-cyan-400"
          thumbClassName="h-3 w-3 rounded-full bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.8)] border-0 opacity-0 group-hover/timeline:opacity-100 transition-opacity"
        />
      </div>

      {/* 2. CONTRÔLES GHOST (Icônes nues) */}
      <div className="flex items-center justify-between">
        {/* GROUPE GAUCHE : Lecture, Volume, Horodatage, Rattrapage */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Play / Pause / Replay */}
          <button
            type="button"
            onClick={togglePlay}
            disabled={isPlayDisabled}
            className="p-1.5 text-white/80 hover:text-white transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            aria-label={
              isAtEnd
                ? t("controls.rewind")
                : status === "playing"
                ? t("controls.pause")
                : t("controls.play")
            }
          >
            {isAtEnd ? (
              <RotateCcw className="w-5 h-5" />
            ) : status === "playing" ? (
              <Pause className="w-5 h-5 fill-current" />
            ) : (
              <Play className="w-5 h-5 fill-current" />
            )}
          </button>

          {/* Volume avec Slider fin */}
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={handleToggleMute}
              className="p-1 text-white/80 hover:text-white transition-colors cursor-pointer"
              title={effectiveMuted ? t("controls.unmute") : t("controls.mute")}
            >
              {effectiveMuted || effectiveVolume === 0 ? (
                <VolumeX className="w-4 h-4 text-rose-400" />
              ) : (
                <Volume2 className="w-4 h-4" />
              )}
            </button>
            <div className="w-14 sm:w-18">
              <Slider
                value={[effectiveMuted ? 0 : effectiveVolume]}
                max={100}
                step={1}
                onValueChange={([val]) => {
                  handleVolumeChange(val);
                  if (effectiveMuted && val > 0) handleToggleMute();
                }}
                className="cursor-pointer py-1"
                trackClassName="h-1 bg-white/20 rounded-full"
                rangeClassName="bg-white/80"
                thumbClassName="h-2.5 w-2.5 rounded-full bg-white shadow-none border-0"
              />
            </div>
          </div>

          {/* Horodatage compact */}
          <span className="text-xs font-mono text-white/70 select-none ml-1">
            {formatTime(displayTime)} / {formatTime(duration)}
          </span>

          {/* Bouton Rattraper */}
          {isBehind && (
            <button
              type="button"
              onClick={catchUp}
              className="flex items-center gap-1 px-1.5 py-0.5 text-xs font-mono text-cyan-400 hover:text-cyan-300 transition-colors cursor-pointer animate-pulse"
              title={t("controls.catchUp")}
            >
              <Zap className="w-3.5 h-3.5 fill-current" />
              <span className="hidden sm:inline">{t("controls.catchUp")}</span>
            </button>
          )}
        </div>

        {/* GROUPE DROIT : Changer de média, Verrou d'hôte, Plein écran */}
        <div className="flex items-center gap-1 sm:gap-2">
          {onChangeMedia && (
            <button
              type="button"
              onClick={onChangeMedia}
              disabled={isChangeMediaDisabled}
              className="p-1.5 text-white/80 hover:text-white transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              title={t("controls.changeMedia")}
              aria-label={t("controls.changeMedia")}
            >
              <Link2 className="w-4 h-4" />
            </button>
          )}

          {/* Verrou d'hôte */}
          {isHost ? (
            <button
              type="button"
              onClick={onToggleLock}
              disabled={isLockDisabled}
              className="p-1.5 text-white/80 hover:text-white transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              title={
                roomSettings.is_locked
                  ? t("controls.roomLocked")
                  : t("controls.roomUnlocked")
              }
              aria-label={
                roomSettings.is_locked
                  ? t("controls.roomLocked")
                  : t("controls.roomUnlocked")
              }
            >
              {roomSettings.is_locked ? (
                <Lock className="w-4 h-4 text-cyan-400" />
              ) : (
                <Unlock className="w-4 h-4" />
              )}
            </button>
          ) : roomSettings.is_locked ? (
            <span
              className="p-1.5 text-amber-400 cursor-help"
              title={t("controls.hostOnly")}
            >
              <Lock className="w-4 h-4" />
            </span>
          ) : null}

          {/* Menu des réglages individuels (Sous-titres, PiP, Télémétrie) */}
          <PlayerSettingsMenu controller={controller} ping={ping} />

          {/* Plein écran */}
          {onToggleFullscreen && (
            <button
              type="button"
              onClick={onToggleFullscreen}
              className="p-1.5 text-white/80 hover:text-white transition-colors cursor-pointer"
              title={
                isFullscreen
                  ? t("controls.exitFullscreen")
                  : t("controls.fullscreen")
              }
              aria-label={
                isFullscreen
                  ? t("controls.exitFullscreen")
                  : t("controls.fullscreen")
              }
            >
              {isFullscreen ? (
                <Minimize className="w-4 h-4" />
              ) : (
                <Maximize className="w-4 h-4" />
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default PlayerControls;
