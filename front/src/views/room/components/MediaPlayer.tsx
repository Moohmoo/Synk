import ReactPlayer from "react-player";
import { useTranslation } from "react-i18next";
import { PlayerController } from "../hooks/usePlayerController";
import { Tv, AlertCircle, Play } from "lucide-react";

interface MediaPlayerProps {
  controller: PlayerController;
  volume?: number;
  isMuted?: boolean;
  isFullscreen?: boolean;
  onToggleFullscreen?: () => void;
}

/**
 * Lecteur multimédia universel (YouTube, Twitch, Vimeo, SoundCloud, flux directs...).
 * Composant de présentation pur s'appuyant sur PlayerController.
 */
export function MediaPlayer({
  controller,
  volume = 100,
  isMuted = false,
  isFullscreen = false,
  onToggleFullscreen,
}: MediaPlayerProps) {
  const { t } = useTranslation("room");
  const {
    videoRef,
    mediaUrl,
    status,
    isPlayDisabled,
    needsAutoplayUnlock,
    togglePlay,
    unlockAutoplay,
    playerProps,
  } = controller;

  return (
    <div
      className={`w-full ${
        isFullscreen ? "flex-1 max-h-[calc(100vh-140px)]" : "max-w-4xl"
      } aspect-video bg-[#0a0a0c] rounded-2xl border border-white/10 shadow-2xl shadow-black/80 relative z-10 flex items-center justify-center overflow-hidden`}
    >
      {status === "idle" ? (
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
      ) : (
        <div className="w-full h-full relative flex items-center justify-center select-none overflow-hidden">
          {/* Lecteur vidéo universel */}
          <div className="w-full h-full pointer-events-none">
            <ReactPlayer
              key={mediaUrl}
              ref={videoRef}
              src={mediaUrl}
              playing={status === "playing"}
              volume={isMuted ? 0 : volume / 100}
              muted={isMuted}
              controls={false}
              width="100%"
              height="100%"
              style={{ width: "100%", height: "100%", display: "block" }}
              {...playerProps}
              config={{
                youtube: {
                  color: "white",
                  rel: 0,
                  iv_load_policy: 3,
                },
              }}
            />
          </div>

          {/* Écran tactile cinéma : 1 clic = toggle play/pause, 2 clics = plein écran */}
          <div
            onClick={togglePlay}
            onDoubleClick={onToggleFullscreen}
            className={`absolute inset-0 z-10 ${
              isPlayDisabled ? "cursor-not-allowed" : "cursor-pointer"
            }`}
          />

          {/* Déblocage de l'autoplay avec son si requis par le navigateur */}
          {needsAutoplayUnlock && (
            <button
              type="button"
              onClick={unlockAutoplay}
              className="absolute top-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2.5 px-4 py-2 bg-[#09090b]/95 hover:bg-[#18181b] border border-[#0ac8b9]/40 hover:border-[#0ac8b9] text-zinc-100 rounded-full shadow-xl shadow-black/50 backdrop-blur-md transition-all cursor-pointer group pointer-events-auto"
            >
              <div className="w-6 h-6 rounded-full bg-[#0ac8b9]/20 flex items-center justify-center text-[#0ac8b9] group-hover:scale-110 transition-transform">
                <Play className="w-3 h-3 fill-current ml-0.5" />
              </div>
              <div className="flex flex-col text-left">
                <span className="text-[11px] font-bold text-zinc-200 uppercase tracking-wider">
                  {t("player.syncOverlayTitle")}
                </span>
                <span className="text-[10px] text-zinc-400">
                  {t("player.syncOverlaySubtitle")}
                </span>
              </div>
            </button>
          )}

          {/* Message d'erreur flux inaccessible */}
          {status === "error" && (
            <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-[#0a0a0c]/95 p-6 text-center select-none backdrop-blur-sm pointer-events-auto">
              <AlertCircle className="w-10 h-10 text-rose-500 mb-3" />
              <p className="text-sm font-semibold text-zinc-200 mb-1">
                {t("player.unsupportedProvider", {
                  defaultValue: "Impossible de charger ce média.",
                })}
              </p>
              <p className="text-xs text-zinc-500 max-w-sm leading-relaxed">
                Le flux est restreint par son propriétaire ou l'URL fournie n'est pas accessible.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
