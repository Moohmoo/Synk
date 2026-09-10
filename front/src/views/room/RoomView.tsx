import { useState, useEffect, useRef, useMemo } from "react";
import { useParams, Navigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { RightSidebarSlot } from "@/components/RightSidebarSlot";
import { roomApi } from "@/services/roomApi";
import { sessionManager } from "@/lib/session";
import { useSyncRoom } from "@/hooks/useSyncRoom";
import { usePlayerController } from "@/hooks/usePlayerController";
import { useCinemaMode } from "@/hooks/useCinemaMode";
import { usePlayerVolume } from "@/hooks/usePlayerVolume";
import { toast } from "@/components/ui/sonner";
import { NotFoundView } from "@/views/NotFoundView";
import { MediaPlayer } from "./components/MediaPlayer";
import { PlayerControls } from "./components/PlayerControls";
import { RoomSessionInfo } from "./components/RoomSessionInfo";
import { RoomDropzone } from "./components/RoomDropzone";
import { ChangeMediaDialog } from "./components/ChangeMediaDialog";
import { RoomMobileInfoSheet } from "./components/RoomMobileInfoSheet";
import { RoomSkeleton } from "./components/RoomSkeleton";

export function RoomView() {
  const { roomId = "" } = useParams<{ roomId: string }>();
  const { t } = useTranslation(["room", "global"]);

  // Vérification synchrone de la session locale en mémoire
  const session = useMemo(() => (roomId ? sessionManager.getRoomSession(roomId) : null), [roomId]);

  // Si pas de salon ou pas de pseudo, redirection immédiate
  if (!roomId || !session?.username) {
    return <Navigate to={roomId ? `/?join=${encodeURIComponent(roomId)}` : "/"} replace />;
  }

  const { username, token, userId } = session;

  const [roomNotFound, setRoomNotFound] = useState(false);
  const [mediaUrlInput, setMediaUrlInput] = useState("");
  const [isChangeMediaOpen, setIsChangeMediaOpen] = useState(false);

  // Effet : Vérification asynchrone non-bloquante de l'existence du salon (HTTP)
  useEffect(() => {
    roomApi
      .checkRoom(roomId)
      .then((res) => {
        if (!res.exists) setRoomNotFound(true);
      })
      .catch(() => {
        // En cas d'erreur HTTP transitoire, le WebSocket prend le relais
      });
  }, [roomId]);

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
  } = useSyncRoom({ roomId, username, token, userId });

  // Contrôleur unifié du lecteur (lecture, pause, seek, rattrapage)
  const playerController = usePlayerController({
    player,
    isHost,
    isLocked: roomSettings.is_locked,
    isRateLimited,
    sendPlay,
    sendPause,
    sendSeek,
  });

  // Gestion du volume et du statut muet persisté
  const { volume, isMuted, setVolume, toggleMute } = usePlayerVolume();
  const cinemaContainerRef = useRef<HTMLDivElement>(null);

  const effectiveUserId = currentUserId || userId;
  const isLockedForGuest = roomSettings.is_locked && !isHost;
  const isChangeMediaDisabled = isLockedForGuest || Boolean(isRateLimited("CHANGE_MEDIA"));

  // Mode cinéma : plein écran, auto-hide des contrôles et raccourcis universels
  const { isFullscreen, areControlsVisible, toggleFullscreen, resetControlsTimeout } =
    useCinemaMode({
      containerRef: cinemaContainerRef,
      controller: playerController,
      volume,
      isMuted,
      onVolumeChange: setVolume,
      onToggleMute: toggleMute,
      onChangeMedia: () => {
        if (!isChangeMediaDisabled) setIsChangeMediaOpen((open) => !open);
      },
    });

  const handleLoadMedia = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanUrl = mediaUrlInput.trim();
    if (!cleanUrl) return;

    if (isChangeMediaDisabled) {
      if (isLockedForGuest) {
        toast.warning(t("controls.hostOnly", { defaultValue: "CONTRÔLES HÔTE EXCLUSIFS" }), {
          id: "room-lock-host-only",
        });
      }
      return;
    }

    changeMedia(cleanUrl);
    setMediaUrlInput("");
    setIsChangeMediaOpen(false);
  };

  if (roomNotFound) {
    return (
      <NotFoundView
        title={t("notFound.title", { ns: "room" })}
        description={t("notFound.description", {
          roomId,
          ns: "room",
          defaultValue: `Le salon ${roomId} n'existe pas ou a expiré.`,
        })}
      />
    );
  }

  const sessionInfoProps = {
    roomId,
    isConnected,
    ping: myPing,
    participants,
    currentUsername,
    currentUserId: effectiveUserId,
  };

  // En attente initiale de connexion pour un invité : prévient tout flash si un média tourne déjà
  const isConnectingGuest = !isConnected && !isHost;

  return (
    <>
      <RightSidebarSlot>
        <div className="animate-fade-in">
          <RoomSessionInfo {...sessionInfoProps} />
        </div>
      </RightSidebarSlot>

      <div className="flex-1 flex flex-col items-center justify-start min-w-0 w-full animate-fade-in">
        {!isFullscreen && <RoomMobileInfoSheet {...sessionInfoProps} />}

        {isConnectingGuest ? (
          <RoomSkeleton />
        ) : (
          <div
            ref={cinemaContainerRef}
            onMouseMove={isFullscreen ? resetControlsTimeout : undefined}
            onTouchStart={isFullscreen ? resetControlsTimeout : undefined}
            className={
              isFullscreen
                ? `fixed inset-0 z-50 w-full h-full bg-black flex items-center justify-center overflow-hidden select-none ${
                    !areControlsVisible && playerController.status === "playing"
                      ? "cursor-none"
                      : "cursor-default"
                  }`
                : "w-full max-w-4xl flex flex-col items-center"
            }
          >
          <MediaPlayer
            controller={playerController}
            volume={volume}
            isMuted={isMuted}
            isFullscreen={isFullscreen}
            onToggleFullscreen={toggleFullscreen}
            emptySlot={
              <RoomDropzone
                value={mediaUrlInput}
                onChange={setMediaUrlInput}
                onSubmit={handleLoadMedia}
                disabled={isChangeMediaDisabled}
              />
            }
          />

          {isFullscreen && (
            <div
              className={`absolute inset-x-0 bottom-0 h-36 bg-gradient-to-t from-black/90 via-black/40 to-transparent pointer-events-none transition-opacity duration-300 z-20 ${
                areControlsVisible ? "opacity-100" : "opacity-0"
              }`}
            />
          )}

          <div
            className={
              isFullscreen
                ? `absolute bottom-3 sm:bottom-5 left-1/2 -translate-x-1/2 w-[calc(100%-1.5rem)] sm:w-[calc(100%-2rem)] max-w-4xl z-30 transition-all duration-300 ${
                    areControlsVisible
                      ? "opacity-100 translate-y-0 pointer-events-auto"
                      : "opacity-0 translate-y-4 pointer-events-none"
                  }`
                : "w-full flex justify-center"
            }
          >
            <PlayerControls
              controller={playerController}
              roomSettings={roomSettings}
              isHost={isHost}
              volume={volume}
              isMuted={isMuted}
              isFullscreen={isFullscreen}
              isLockDisabled={!isHost || Boolean(isRateLimited("UPDATE_SETTINGS"))}
              isChangeMediaDisabled={isChangeMediaDisabled}
              onChangeMedia={() => setIsChangeMediaOpen(true)}
              onToggleLock={() => {
                if (!isHost || isRateLimited("UPDATE_SETTINGS")) return;
                updateSettings(!roomSettings.is_locked);
              }}
              onVolumeChange={setVolume}
              onToggleMute={toggleMute}
              onToggleFullscreen={toggleFullscreen}
            />
          </div>
        </div>
        )}
      </div>

      <ChangeMediaDialog
        open={isChangeMediaOpen}
        onOpenChange={setIsChangeMediaOpen}
        value={mediaUrlInput}
        onChange={setMediaUrlInput}
        onSubmit={handleLoadMedia}
        disabled={isChangeMediaDisabled}
      />
    </>
  );
}
