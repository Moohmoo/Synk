import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
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
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation(["room", "global"]);
  const setGlowColor = useUIStore((s) => s.setGlowColor);

  const [username, setUsername] = useState<string>("");
  const [token, setToken] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [roomNotFound, setRoomNotFound] = useState(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [mediaDuration, setMediaDuration] = useState<number>(0);

  // Barre de commande média (URL)
  const [mediaUrl, setMediaUrl] = useState("");

  // Route Guard : vérifie la session du salon ou redirige vers l'accueil pour saisie
  useEffect(() => {
    if (!roomId) {
      navigate("/", { replace: true });
      return;
    }

    const session = sessionManager.getRoomSession(roomId);

    if (!session.username) {
      // Redirection immédiate vers l'accueil avec pré-remplissage du salon
      navigate(`/?join=${encodeURIComponent(roomId)}`, { replace: true });
      return;
    }

    setUsername(session.username);
    setToken(session.token);
    setUserId(session.userId);

    // Vérifier si le salon existe toujours côté serveur
    roomApi
      .checkRoom(roomId)
      .then((res) => {
        if (!res.exists) {
          setRoomNotFound(true);
        }
      })
      .catch(() => {
        // Erreur réseau : on laisse WebSocket tenter la reconnexion
      })
      .finally(() => {
        setIsInitializing(false);
      });
  }, [roomId, navigate]);

  // Synchronise la couleur de l'Ambient Glow global
  useEffect(() => {
    if (roomNotFound) {
      setGlowColor("red");
    } else {
      setGlowColor("cyan");
    }
  }, [roomNotFound, setGlowColor]);

  // Synchronisation WebSocket
  const {
    isConnected,
    participants,
    player,
    roomSettings,
    currentUsername,
    currentUserId,
    myPing,
    sendPlay,
    sendPause,
    sendSeek,
    changeMedia,
    updateSettings,
  } = useSyncRoom({
    roomId: roomId || "",
    username,
    token,
    userId,
  });

  // Synchronisation de la durée avec l'état du lecteur
  useEffect(() => {
    if (player.duration && player.duration > 0) {
      setMediaDuration(player.duration);
    } else if (!player.media_id) {
      setMediaDuration(0);
    }
  }, [player.media_id, player.duration]);

  // Contrôles locaux du lecteur (Volume local & Plein écran)
  const [volume, setVolume] = useState<number>(() => {
    const saved = localStorage.getItem("synk_volume");
    return saved !== null ? Number(saved) : 100;
  });
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const cinemaContainerRef = useRef<HTMLDivElement>(null);

  const handleVolumeChange = (newVolume: number) => {
    setVolume(newVolume);
    localStorage.setItem("synk_volume", String(newVolume));
  };

  const handleToggleMute = () => {
    if (isMuted) {
      setIsMuted(false);
      if (volume === 0) {
        handleVolumeChange(50);
      }
    } else {
      setIsMuted(true);
    }
  };

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
      cinemaContainerRef.current.requestFullscreen().catch(() => {
        // Ignorer ou plein écran non autorisé par le navigateur
      });
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };

  // Déterminer si l'utilisateur courant est hôte
  const effectiveUserId = currentUserId || userId;
  const currentParticipant = participants.find(
    (p) => (effectiveUserId && p.id === effectiveUserId) || p.username === currentUsername
  );
  const isHost = Boolean(currentParticipant?.is_host);

  const handleLoadMedia = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanUrl = mediaUrl.trim();
    if (!cleanUrl) return;
    if (roomSettings.is_locked && !isHost) {
      toast.warning(t("controls.hostOnly", { defaultValue: "CONTRÔLES HÔTE EXCLUSIFS" }), {
        id: "room-lock-host-only",
      });
      return;
    }
    changeMedia(cleanUrl);
    setMediaUrl("");
  };

  const handleTogglePlay = (time?: number) => {
    if (roomSettings.is_locked && !isHost) {
      toast.warning(t("controls.hostOnly", { defaultValue: "CONTRÔLES HÔTE EXCLUSIFS" }), {
        id: "room-lock-host-only",
      });
      return;
    }
    const pos = typeof time === "number" ? time : currentTime;
    if (player.is_playing) {
      sendPause(pos);
    } else {
      const isAtEnd = mediaDuration > 0 && pos >= mediaDuration - 0.5;
      sendPlay(isAtEnd ? 0 : pos);
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

  if (isInitializing || !username) {
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
          roomId={roomId || ""}
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
          disabled={roomSettings.is_locked && !isHost}
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
            player={player}
            roomSettings={roomSettings}
            isHost={isHost}
            volume={volume}
            isMuted={isMuted}
            isFullscreen={isFullscreen}
            onProgress={(time) => setCurrentTime(time)}
            onDurationChange={(d) => setMediaDuration(d)}
            onEnded={() => {
              if (isHost && player.is_playing) {
                sendPause(mediaDuration || player.duration);
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
            onTogglePlay={() => handleTogglePlay()}
            onSeek={(time) => sendSeek(time)}
            onToggleLock={() => updateSettings(!roomSettings.is_locked)}
            onVolumeChange={handleVolumeChange}
            onToggleMute={handleToggleMute}
            onToggleFullscreen={toggleFullscreen}
          />
        </div>
      </div>
    </>
  );
}

export default RoomView;
