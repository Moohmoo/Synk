import { useTranslation } from "react-i18next";
import { PlayerState, RoomSettings } from "@/types/room";
import { Tv, AlertCircle } from "lucide-react";
import { YouTubePlayer } from "./players/YouTubePlayer";

interface MediaPlayerProps {
  player: PlayerState;
  roomSettings: RoomSettings;
  isHost: boolean;
  duration?: number;
  volume?: number;
  isMuted?: boolean;
  isFullscreen?: boolean;
  onLocalPlay?: (time: number) => void;
  onLocalPause?: (time: number) => void;
  onLocalSeek?: (time: number) => void;
  onDurationChange?: (duration: number) => void;
}

/**
 * Lecteur multimédia centralisé et agnostique du fournisseur.
 * Gère le conteneur d'affichage, l'état d'attente et délègue aux adaptateurs spécifiques selon `player.provider`.
 */
export function MediaPlayer({
  player,
  roomSettings,
  isHost,
  duration = 0,
  volume = 100,
  isMuted = false,
  isFullscreen = false,
  onLocalPlay,
  onLocalPause,
  onDurationChange,
}: MediaPlayerProps) {
  const { t } = useTranslation("room");

  const renderContent = () => {
    // 1. Étant en attente de média
    if (!player.media_id) {
      return (
        <div className="flex flex-col items-center justify-center gap-3 text-zinc-600 p-8 text-center select-none">
          <div className="w-16 h-16 border border-zinc-800 bg-zinc-900/50 flex items-center justify-center">
            <Tv className="w-8 h-8 text-zinc-700" />
          </div>
          <div>
            <div className="text-sm font-mono uppercase tracking-wider text-zinc-400 font-semibold">
              {t("player.waitingTitle")}
            </div>
            <div className="text-xs text-zinc-600 font-mono mt-1">
              {t("player.waitingSubtitle")}
            </div>
          </div>
        </div>
      );
    }

    // 2. Routage selon le provider (extensible : YouTube, SoundCloud, Twitch, etc.)
    const provider = player.provider || "youtube";

    switch (provider) {
      case "youtube":
        return (
          <YouTubePlayer
            key={player.media_id}
            mediaId={player.media_id}
            isPlaying={player.is_playing}
            currentTime={player.current_time}
            duration={duration || player.duration}
            lastUpdatedAt={player.last_updated_at}
            isLocked={roomSettings.is_locked}
            isHost={isHost}
            volume={volume}
            isMuted={isMuted}
            onLocalPlay={onLocalPlay}
            onLocalPause={onLocalPause}
            onDurationChange={onDurationChange}
          />
        );

      default:
        return (
          <div className="flex flex-col items-center justify-center gap-2 text-zinc-400 p-8 text-center">
            <AlertCircle className="w-8 h-8 text-amber-500" />
            <p className="text-sm font-mono">
              {t("player.unsupportedProvider", {
                provider,
                defaultValue: `Plateforme "${provider}" non prise en charge.`,
              })}
            </p>
          </div>
        );
    }
  };

  return (
    <div
      className={`w-full ${
        isFullscreen ? "flex-1 max-h-[calc(100vh-140px)]" : "max-w-4xl"
      } aspect-video bg-[#0a0a0c] rounded-2xl border border-white/10 shadow-2xl shadow-black/80 relative z-10 flex items-center justify-center overflow-hidden transition-all duration-200`}
    >
      {renderContent()}
    </div>
  );
}
