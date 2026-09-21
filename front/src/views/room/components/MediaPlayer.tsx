import ReactPlayer from "react-player";
import { useTranslation } from "react-i18next";
import { PlayerController } from "@/hooks/usePlayer";
import { AlertCircle, Play, RotateCcw } from "lucide-react";

interface MediaPlayerProps {
  controller: PlayerController;
  volume?: number;
  isMuted?: boolean;
  isFullscreen?: boolean;
  onToggleFullscreen?: () => void;
  emptySlot?: React.ReactNode;
  controlsSlot?: React.ReactNode;
}

/**
 * Lecteur multimédia universel (YouTube, Twitch, Vimeo, SoundCloud, flux directs...).
 * - Maintient strictement le ratio 16:9 cinématographique (zéro CLS).
 * - Intègre les contrôles en overlay flottant semi-transparent au survol.
 */
export function MediaPlayer({
  controller,
  volume,
  isMuted,
  isFullscreen = false,
  onToggleFullscreen,
  emptySlot,
  controlsSlot,
}: MediaPlayerProps) {
  const { t } = useTranslation("room");
  const effectiveVolume = volume ?? controller.volume;
  const effectiveMuted = isMuted ?? controller.isMuted;
  const {
    videoRef,
    mediaUrl,
    status,
    isPlayDisabled,
    needsAutoplayUnlock,
    subtitlesEnabled,
    togglePlay,
    unlockAutoplay,
    playerProps,
  } = controller;

  return (
    <div
      className={`w-full ${
        isFullscreen
          ? "w-full h-full max-w-none max-h-none rounded-none border-0 shadow-none"
          : "aspect-video rounded-xl border border-white/10 shadow-2xl"
      } bg-black relative z-10 flex items-center justify-center select-none overflow-hidden group`}
    >
      {status === "idle" ? (
        emptySlot
      ) : (
        <>
          {/*
            Lecteur vidéo universel :
            - playsInline : obligatoire pour iOS Safari afin d'éviter le basculement forcé vers le player natif plein écran Apple.
            - playerVars.playsinline : paramètre officiel YouTube pour conserver la vidéo incrustée sur mobile.
          */}
          <div className="w-full h-full pointer-events-none">
            <ReactPlayer
              key={mediaUrl}
              ref={videoRef}
              src={mediaUrl}
              playing={status === "playing"}
              volume={effectiveMuted ? 0 : effectiveVolume / 100}
              muted={effectiveMuted}
              controls={false}
              playsInline
              width="100%"
              height="100%"
              {...playerProps}
              config={{
                youtube: {
                  color: "white",
                  rel: 0,
                  iv_load_policy: 3,
                  disablekb: 1,
                  fs: 0,
                  cc_load_policy: subtitlesEnabled ? 1 : 0,
                },
              }}
            />
          </div>

          {/* 
            Écran tactile cinéma :
            - touch-manipulation : élimine le délai de 300ms et prévient le zoom double-tap involontaire sur mobile.
            - 1 clic = bascule play/pause, 2 clics = plein écran.
            - Voile sombre et léger flou à la pause pour atténuer les recommandations YouTube.
          */}
          <div
            onClick={togglePlay}
            onDoubleClick={onToggleFullscreen}
            className={`absolute inset-0 z-10 touch-manipulation transition-all duration-300 ${
              status === "paused" || status === "ended"
                ? "bg-black/50 backdrop-blur-[1.5px]"
                : "bg-transparent"
            } ${isPlayDisabled ? "cursor-not-allowed" : "cursor-pointer"}`}
          />

          {/* Bouton Replay central lorsque la vidéo est terminée */}
          {status === "ended" && !isPlayDisabled && (
            <button
              type="button"
              onClick={togglePlay}
              className="absolute z-20 p-4 rounded-full bg-black/60 hover:bg-black/80 border border-white/20 hover:border-primary text-white/90 hover:text-primary-hover hover:scale-110 transition-all shadow-2xl backdrop-blur-md cursor-pointer group pointer-events-auto"
              aria-label={t("controls.rewind")}
            >
              <RotateCcw className="w-8 h-8 transition-transform group-hover:-rotate-45" />
            </button>
          )}

          {/* Déblocage de l'autoplay avec son si requis par le navigateur */}
          {needsAutoplayUnlock && (
            <button
              type="button"
              onClick={unlockAutoplay}
              className="absolute top-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2.5 px-4 py-2 bg-[#09090b]/95 hover:bg-[#18181b] border border-primary/40 hover:border-primary text-zinc-100 rounded-sm shadow-xl shadow-black/50 backdrop-blur-md transition-all cursor-pointer group pointer-events-auto"
            >
              <div className="w-6 h-6 rounded-sm bg-primary/20 flex items-center justify-center text-primary group-hover:scale-105 transition-transform">
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
                {t("player.errorTitle", {
                  defaultValue: "Impossible de charger ce média.",
                })}
              </p>
              <p className="text-xs text-zinc-500 max-w-sm leading-relaxed">
                {t("player.errorDescription", {
                  defaultValue: "Le flux est restreint par son propriétaire ou l'URL fournie n'est pas accessible.",
                })}
              </p>
            </div>
          )}

          {/* Contrôles de lecture (overlay) */}
          {controlsSlot}
        </>
      )}
    </div>
  );
}
