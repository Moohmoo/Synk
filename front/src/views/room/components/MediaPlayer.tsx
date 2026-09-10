import ReactPlayer from "react-player";
import { useTranslation } from "react-i18next";
import { PlayerController } from "@/hooks/usePlayerController";
import { AlertCircle, Play } from "lucide-react";

interface MediaPlayerProps {
  controller: PlayerController;
  volume?: number;
  isMuted?: boolean;
  isFullscreen?: boolean;
  onToggleFullscreen?: () => void;
  emptySlot?: React.ReactNode;
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
  emptySlot,
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

  // Conteneur Cinéma Universel :
  // - En état de lecture : aspect-video strict garanti (16:9 cinématographique sans distorsion).
  // - En état d'attente (idle) : sur mobile (< 640px), un ratio rigide 16:9 comprimerait excessivement
  //   le contenu d'accueil (titre, Omnibox, badges) dans ~190px de haut. On applique donc min-h-[260px]
  //   avec padding vertical pour laisser respirer l'accueil, tout en restaurant aspect-video dès 'sm:'.
  return (
    <div
      className={`w-full ${
        isFullscreen
          ? "w-full h-full max-w-none max-h-none rounded-none border-0 shadow-none"
          : "max-w-4xl aspect-video rounded-sm border border-white/10 shadow-2xl shadow-black/80"
      } ${
        !isFullscreen && status === "idle"
          ? "min-h-[260px] sm:aspect-video py-6 sm:py-0"
          : ""
      } bg-[#0a0a0c] relative z-10 flex items-center justify-center select-none overflow-hidden`}
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
              volume={isMuted ? 0 : volume / 100}
              muted={isMuted}
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
                },
              }}
            />
          </div>

          {/* 
            Écran tactile cinéma :
            - touch-manipulation : élimine le délai de 300ms et prévient le zoom double-tap involontaire sur mobile.
            - 1 clic = bascule play/pause, 2 clics = plein écran.
          */}
          <div
            onClick={togglePlay}
            onDoubleClick={onToggleFullscreen}
            className={`absolute inset-0 z-10 touch-manipulation ${
              isPlayDisabled ? "cursor-not-allowed" : "cursor-pointer"
            }`}
          />

          {/* Déblocage de l'autoplay avec son si requis par le navigateur */}
          {needsAutoplayUnlock && (
            <button
              type="button"
              onClick={unlockAutoplay}
              className="absolute top-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2.5 px-4 py-2 bg-[#09090b]/95 hover:bg-[#18181b] border border-[#0ac8b9]/40 hover:border-[#0ac8b9] text-zinc-100 rounded-sm shadow-xl shadow-black/50 backdrop-blur-md transition-all cursor-pointer group pointer-events-auto"
            >
              <div className="w-6 h-6 rounded-sm bg-[#0ac8b9]/20 flex items-center justify-center text-[#0ac8b9] group-hover:scale-105 transition-transform">
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
        </>
      )}
    </div>
  );
}
