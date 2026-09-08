import { useState, useEffect, useRef, useMemo } from "react";
import { useParams, useNavigate, Navigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Omnibox } from "@/components/shared";
import { RightSidebarSlot } from "@/components/RightSidebarSlot";
import { roomApi } from "@/services/roomApi";
import { sessionManager } from "@/lib/session";
import { useSyncRoom } from "@/hooks/useSyncRoom";
import { toast } from "@/components/ui/sonner";
import { useUIStore } from "@/stores/uiStore";
import { MediaPlayer } from "./components/MediaPlayer";
import { PlayerControls } from "./components/PlayerControls";
import { RoomSessionInfo } from "./components/RoomSessionInfo";

export function RoomView() {
  const { roomId = "" } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation(["room", "global"]);
  const setGlowColor = useUIStore((s) => s.setGlowColor);

  // Vérification synchrone de la session locale en mémoire
  const session = useMemo(() => (roomId ? sessionManager.getRoomSession(roomId) : null), [roomId]);

  // Si pas de salon ou pas de pseudo, redirection déclarative immédiate sans délai ni useEffect
  if (!roomId || !session?.username) {
    return <Navigate to={roomId ? `/?join=${encodeURIComponent(roomId)}` : "/"} replace />;
  }

  const username = session.username;
  const token = session.token;
  const userId = session.userId;

  const [isInitializing, setIsInitializing] = useState(true);
  const [roomNotFound, setRoomNotFound] = useState(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [localDuration, setLocalDuration] = useState<number>(0);
  const [mediaUrl, setMediaUrl] = useState("");

  // Effet 1 : Vérification d'existence du salon côté serveur (HTTP) & Glow
  useEffect(() => {
    roomApi
      .checkRoom(roomId)
      .then((res) => {
        if (!res.exists) {
          setRoomNotFound(true);
          setGlowColor("red");
        }
      })
      .catch(() => {
        // En cas d'erreur HTTP transitoire, le WebSocket prend le relais
      })
      .finally(() => {
        setIsInitializing(false);
      });

    return () => {
      setGlowColor("cyan");
    };
  }, [roomId, setGlowColor]);

  // Synchronisation temps réel via WebSocket
  const {
    isConnected,
    participants,
    player,
    roomSettings,
    currentUsername,
    currentUserId,
    isHost,
    isRateLimited,
    myPing,
    sendPlay,
    sendPause,
    sendSeek,
    changeMedia,
    updateSettings,
  } = useSyncRoom({
    roomId,
    username,
    token,
    userId,
  });

  // Durée dérivée : valeur calculée directement à l'affichage, aucun useEffect miroir
  const mediaDuration = player.duration && player.duration > 0 ? player.duration : localDuration;

  // Contrôles locaux du lecteur (Volume local & Plein écran)
  const [volume, setVolume] = useState<number>(() => {
    const saved = localStorage.getItem("synk_volume");
    return saved !== null ? Number(saved) : 100;
  });
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const cinemaContainerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  const handleVolumeChange = (newVolume: number) => {
    setVolume(newVolume);
    localStorage.setItem("synk_volume", String(newVolume));
  };

  const handleToggleMute = () => {
    if (isMuted) {
      setIsMuted(false);
      if (volume === 0) handleVolumeChange(50);
    } else {
      setIsMuted(true);
    }
  };

  // Effet 2 : Écouteur natif de bascule plein écran du navigateur
  useEffect(() => {
    const onFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", onFullscreenChange);
  }, []);

  const toggleFullscreen = () => {
    if (!cinemaContainerRef.current) return;
    if (!document.fullscreenElement) {
      cinemaContainerRef.current.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };

  const effectiveUserId = currentUserId || userId;
  const isLockedForGuest = roomSettings.is_locked && !isHost;

  const handleLoadMedia = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanUrl = mediaUrl.trim();
    if (!cleanUrl) return;
    if (isLockedForGuest || isRateLimited("CHANGE_MEDIA")) {
      if (isLockedForGuest) {
        toast.warning(t("controls.hostOnly", { defaultValue: "CONTRÔLES HÔTE EXCLUSIFS" }), {
          id: "room-lock-host-only",
        });
      }
      return;
    }
    changeMedia(cleanUrl);
    setMediaUrl("");
  };

  const handleTogglePlay = (time?: number) => {
    if (isLockedForGuest || isRateLimited("PLAY") || isRateLimited("PAUSE")) {
      if (isLockedForGuest) {
        toast.warning(t("controls.hostOnly", { defaultValue: "CONTRÔLES HÔTE EXCLUSIFS" }), {
          id: "room-lock-host-only",
        });
      }
      return;
    }
    const pos = typeof time === "number" ? time : currentTime;
    const isAtEnd = mediaDuration > 0 && pos >= mediaDuration - 0.5;

    if (isAtEnd) {
      if (videoRef.current) {
        videoRef.current.currentTime = 0;
      }
      setCurrentTime(0);
      sendPlay(0);
      return;
    }

    if (player.is_playing) {
      sendPause(pos);
    } else {
      sendPlay(pos);
    }
  };

  if (roomNotFound) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-center max-w-md mx-auto select-none py-12">
        <h1 className="text-sm font-semibold text-zinc-400 mb-2 tracking-widest uppercase">
          {t("notFound.title", { ns: "room" })}
        </h1>
        <p className="text-xs text-zinc-500 mb-6 leading-relaxed">
          {t("notFound.description", {
            roomId,
            ns: "room",
            defaultValue: `Le salon ${roomId} n'existe pas ou a expiré.`,
          })}
        </p>
        <button
          type="button"
          onClick={() => navigate("/")}
          className="px-4 py-2 rounded-lg text-xs font-semibold bg-[#27272a] text-white hover:bg-[#3f3f46] transition-colors cursor-pointer"
        >
          {t("notFound.backHome", { ns: "room" })}
        </button>
      </div>
    );
  }

  if (isInitializing) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center py-12">
        <div className="w-6 h-6 border-2 border-[#0ac8b9] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <>
      <RightSidebarSlot>
        <RoomSessionInfo
          roomId={roomId}
          isConnected={isConnected}
          ping={myPing}
          participants={participants}
          currentUsername={currentUsername}
          currentUserId={effectiveUserId}
        />
      </RightSidebarSlot>

      <div className="flex-1 flex flex-col items-center justify-center min-w-0 w-full">
        {/* LA BARRE DE COMMANDE (URL) : Omnibox réutilisée au-dessus du lecteur */}
        <Omnibox
          value={mediaUrl}
          onChange={(e) => setMediaUrl(e.target.value)}
          onSubmit={handleLoadMedia}
          mode="join"
          placeholder={t("header.urlPlaceholder")}
          buttonText={t("header.load")}
          disabled={isLockedForGuest || isRateLimited("CHANGE_MEDIA")}
          maxLength={2048}
          className="w-full max-w-4xl mb-6 relative z-20"
        />

        {/* ESPACE CINÉMA UNIFIÉ : Lecteur & Barre de Contrôle */}
        <div
          ref={cinemaContainerRef}
          className={
            isFullscreen
              ? "fixed inset-0 z-50 bg-[#0a0a0c] flex flex-col items-center justify-center p-4 sm:p-6 w-full h-full"
              : "w-full max-w-4xl flex flex-col items-center"
          }
        >
          {/* LE LECTEUR MULTIMÉDIA : Conteneur Cinéma Universel */}
          <MediaPlayer
            playerRef={videoRef}
            player={player}
            roomSettings={roomSettings}
            isHost={isHost}
            volume={volume}
            isMuted={isMuted}
            isFullscreen={isFullscreen}
            isRateLimited={isRateLimited}
            onProgress={setCurrentTime}
            onDurationChange={setLocalDuration}
            onEnded={() => {
              const finalTime = mediaDuration > 0 ? mediaDuration : (videoRef.current?.duration || 0);
              if (finalTime > 0) {
                setCurrentTime(finalTime);
              }
            }}
            onTogglePlay={() => handleTogglePlay()}
            onToggleFullscreen={toggleFullscreen}
          />

          {/* Barre de Contrôle du Lecteur & Verrou d'hôte */}
          <PlayerControls
            player={player}
            roomSettings={roomSettings}
            isHost={isHost}
            currentTime={currentTime}
            duration={mediaDuration}
            volume={volume}
            isMuted={isMuted}
            isFullscreen={isFullscreen}
            isRateLimited={isRateLimited}
            onTogglePlay={() => handleTogglePlay()}
            onSeek={(time) => {
              if (isLockedForGuest || isRateLimited("SEEK")) {
                return;
              }
              if (videoRef.current) {
                videoRef.current.currentTime = time;
              }
              setCurrentTime(time);
              sendSeek(time);
            }}
            onToggleLock={() => {
              if (!isHost || isRateLimited("UPDATE_SETTINGS")) return;
              updateSettings(!roomSettings.is_locked);
            }}
            onVolumeChange={handleVolumeChange}
            onToggleMute={handleToggleMute}
            onToggleFullscreen={toggleFullscreen}
          />
        </div>
      </div>
    </>
  );
}
