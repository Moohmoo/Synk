import { useEffect, useRef, useState, useMemo } from "react";
import ReactPlayer from "react-player";
import { useTranslation } from "react-i18next";
import { PlayerState, RoomSettings } from "@/types/room";
import { Tv, AlertCircle, Play } from "lucide-react";

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
 * Lecteur multimédia universel (YouTube, Twitch, Vimeo, flux directs...).
 * S'appuie sur react-player et l'interface standard HTMLMediaElement pour
 * garantir synchronisation robuste, absence de fuites mémoire et code concis.
 */
export function MediaPlayer({
  player,
  roomSettings,
  isHost,
  volume = 100,
  isMuted = false,
  isFullscreen = false,
  onLocalPlay,
  onLocalPause,
  onLocalSeek,
  onDurationChange,
}: MediaPlayerProps) {
  const { t } = useTranslation("room");
  const playerRef = useRef<HTMLVideoElement | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [needsAutoplayUnlock, setNeedsAutoplayUnlock] = useState(false);

  const mediaUrl = useMemo(() => resolveMediaUrl(player), [player.media_url, player.media_id, player.provider]);
  const isLockedForGuest = roomSettings.is_locked && !isHost;

  // Réinitialiser l'état lors d'un changement de flux média
  useEffect(() => {
    setIsReady(false);
    setHasError(false);
    setNeedsAutoplayUnlock(false);
  }, [mediaUrl]);

  // Synchronisation temporelle (Dead Reckoning & rattrapage de dérive)
  useEffect(() => {
    if (!playerRef.current || !isReady) return;

    const now = Date.now();
    const elapsed = player.is_playing
      ? Math.max(0, (now - (player.last_updated_at || now)) / 1000)
      : 0;
    const targetTime = player.current_time + elapsed;
    const currentLocalTime = playerRef.current.currentTime || 0;
    const drift = Math.abs(currentLocalTime - targetTime);

    // Si le décalage dépasse la tolérance de 1.5s, recaler la tête de lecture
    if (drift > 1.5) {
      playerRef.current.currentTime = targetTime;
    }
  }, [player.current_time, player.last_updated_at, player.is_playing, isReady]);

  // Notifier la durée détectée
  const handleDuration = () => {
    if (playerRef.current?.duration && onDurationChange) {
      onDurationChange(playerRef.current.duration);
    }
  };

  const handleReady = () => {
    setIsReady(true);
    setHasError(false);
    handleDuration();

    if (playerRef.current) {
      const now = Date.now();
      const elapsed = player.is_playing
        ? Math.max(0, (now - (player.last_updated_at || now)) / 1000)
        : 0;
      playerRef.current.currentTime = player.current_time + elapsed;
    }
  };

  // Gestion des événements locaux du lecteur (anti-écho)
  const handlePlay = () => {
    setNeedsAutoplayUnlock(false);
    if (!playerRef.current) return;

    // Déclenché par interaction utilisateur directe sur l'iframe alors que le salon était en pause
    if (!player.is_playing) {
      if (isLockedForGuest) {
        playerRef.current.pause();
        return;
      }
      onLocalPlay?.(playerRef.current.currentTime || 0);
    }
  };

  const handlePause = () => {
    if (!playerRef.current) return;

    // Déclenché par interaction utilisateur directe sur l'iframe alors que le salon était en lecture
    if (player.is_playing) {
      if (isLockedForGuest) {
        playerRef.current.play();
        return;
      }
      onLocalPause?.(playerRef.current.currentTime || 0);
    }
  };

  const handleEnded = () => {
    if (!playerRef.current) return;
    if (player.is_playing) {
      const end = playerRef.current.duration || playerRef.current.currentTime || 0;
      onLocalPause?.(end);
    }
  };

  const handleSeeked = () => {
    if (!playerRef.current || isLockedForGuest) return;
    onLocalSeek?.(playerRef.current.currentTime || 0);
  };

  // Déblocage manuel au clic si l'Autoplay Policy du navigateur bloque la lecture avec son
  const handleUnlockAutoplay = () => {
    if (playerRef.current) {
      playerRef.current
        .play()
        .then(() => setNeedsAutoplayUnlock(false))
        .catch(() => {});
    }
  };

  return (
    <div
      className={`w-full ${
        isFullscreen ? "flex-1 max-h-[calc(100vh-140px)]" : "max-w-4xl"
      } aspect-video bg-[#0a0a0c] rounded-2xl border border-white/10 shadow-2xl shadow-black/80 relative z-10 flex items-center justify-center overflow-hidden transition-all duration-200`}
    >
      {/* 1. État d'attente quand aucun média n'est sélectionné */}
      {!mediaUrl ? (
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
        <div
          className={`w-full h-full relative flex items-center justify-center ${
            isLockedForGuest ? "pointer-events-none" : ""
          }`}
        >
          <ReactPlayer
            key={mediaUrl}
            ref={playerRef}
            src={mediaUrl}
            playing={player.is_playing}
            volume={isMuted ? 0 : volume / 100}
            muted={isMuted}
            controls={false}
            width="100%"
            height="100%"
            style={{ width: "100%", height: "100%", display: "block" }}
            onReady={handleReady}
            onPlay={handlePlay}
            onPause={handlePause}
            onEnded={handleEnded}
            onSeeked={handleSeeked}
            onDurationChange={handleDuration}
            onLoadedMetadata={handleDuration}
            onError={() => {
              if (player.is_playing) {
                setNeedsAutoplayUnlock(true);
              } else {
                setHasError(true);
              }
            }}
            config={{
              youtube: {
                color: "white",
                rel: 0,
                iv_load_policy: 3,
              },
            }}
          />

          {/* Indicateur d'initialisation */}
          {!isReady && !hasError && (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-black/90 select-none">
              <div className="w-8 h-8 border-2 border-[#0ac8b9] border-t-transparent rounded-full animate-spin mb-3" />
              <span className="text-[11px] font-mono text-zinc-500 uppercase tracking-wider">
                {t("player.syncing", { defaultValue: "Initialisation du lecteur..." })}
              </span>
            </div>
          )}

          {/* Bannière de reprise si l'Autoplay est bloqué */}
          {needsAutoplayUnlock && (
            <button
              type="button"
              onClick={handleUnlockAutoplay}
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

          {/* Écran d'erreur en cas de flux média indisponible ou restreint */}
          {hasError && (
            <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-[#0a0a0c]/95 p-6 text-center select-none backdrop-blur-sm pointer-events-auto">
              <AlertCircle className="w-10 h-10 text-rose-500 mb-3" />
              <p className="text-sm font-semibold text-zinc-200 mb-1">
                {t("player.unsupportedProvider", {
                  provider: player.provider || "média",
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
