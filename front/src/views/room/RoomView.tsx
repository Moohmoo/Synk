import { useState, useEffect, useRef, useMemo } from "react";
import { useParams, Navigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { RightSidebarSlot } from "@/components/RightSidebarSlot";
import { roomApi } from "@/services/roomApi";
import { sessionManager } from "@/lib/session";
import { useRoom } from "@/hooks/useRoom";
import { usePlayer } from "@/hooks/usePlayer";
import { useCinemaMode } from "@/hooks/useCinemaMode";
import { usePlayerShortcuts } from "@/hooks/usePlayerShortcuts";
import { toast } from "@/components/ui/sonner";
import { NotFoundView } from "@/views/NotFoundView";
import { MediaPlayer } from "./components/MediaPlayer";
import { PlayerControls } from "./components/PlayerControls";
import { SidePanel } from "./components/SidePanel";
import { MetaSection } from "./components/MetaSection";
import { Dropzone } from "./components/Dropzone";
import { ChangeMediaDialog } from "./components/ChangeMediaDialog";
import { Drawer } from "./components/Drawer";
import { Skeleton } from "./components/Skeleton";

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

  // Synchronisation temps réel via WebSocket (incluant chat et participants)
  const {
    isConnected,
    participants,
    player,
    roomSettings,
    messages,
    currentUsername,
    currentUserId,
    isHost,
    isRateLimited,
    myPing,
    sendPlay,
    sendPause,
    sendSeek,
    sendChat,
    changeMedia,
    updateSettings,
    sendHeartbeat,
    serverTimeOffset,
  } = useRoom({ roomId, username, token, userId });

  // Contrôleur unifié du lecteur (lecture, pause, seek, rattrapage, volume et mute)
  const playerController = usePlayer({
    player,
    isHost,
    isLocked: roomSettings.is_locked,
    isRateLimited,
    sendPlay,
    sendPause,
    sendSeek,
    sendHeartbeat,
    serverTimeOffset,
  });

  const cinemaContainerRef = useRef<HTMLDivElement>(null);

  const effectiveUserId = currentUserId || userId;
  const isLockedForGuest = roomSettings.is_locked && !isHost;
  const isChangeMediaDisabled = isLockedForGuest || Boolean(isRateLimited("CHANGE_MEDIA"));

  // Mode cinéma : plein écran et auto-hide des contrôles au repos
  const { isFullscreen, areControlsVisible, toggleFullscreen, resetControlsTimeout } =
    useCinemaMode({
      containerRef: cinemaContainerRef,
      playerStatus: playerController.status,
    });

  // Raccourcis clavier universels (Espace, K, F, M, Flèches, C/S, Cmd+K, Échap)
  usePlayerShortcuts({
    controller: playerController,
    toggleFullscreen,
    isFullscreen,
    resetControlsTimeout,
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

  const sidePanelProps = {
    roomId,
    isConnected,
    ping: myPing,
    participants,
    currentUsername,
    currentUserId: effectiveUserId,
    messages,
    onSendMessage: sendChat,
    playerStatus: playerController.status,
    isChatDisabled: !isConnected || Boolean(isRateLimited("CHAT_MESSAGE")),
  };

  // En attente initiale de connexion pour un invité : prévient tout flash si un média tourne déjà
  const isConnectingGuest = !isConnected && !isHost;

  return (
    <>
      <RightSidebarSlot>
        <div className="h-full animate-fade-in">
          <SidePanel {...sidePanelProps} />
        </div>
      </RightSidebarSlot>

      <div className="flex-1 min-w-0 flex flex-col w-full animate-fade-in">
        {isConnectingGuest ? (
          <Skeleton />
        ) : (
          <div
            ref={cinemaContainerRef}
            onMouseMove={resetControlsTimeout}
            onTouchStart={resetControlsTimeout}
            className={
              isFullscreen
                ? `fixed inset-0 z-50 w-full h-full bg-black flex items-center justify-center overflow-hidden select-none ${
                    !areControlsVisible && playerController.status === "playing"
                      ? "cursor-none"
                      : "cursor-default"
                  }`
                : "w-full flex flex-col"
            }
          >
            {/* LECTEUR VIDÉO 16:9 AVEC CONTRÔLES EN OVERLAY FLOTTANT AU SURVOL */}
            <MediaPlayer
              controller={playerController}
              isFullscreen={isFullscreen}
              onToggleFullscreen={toggleFullscreen}
              areControlsVisible={areControlsVisible}
              controlsSlot={
                <PlayerControls
                  controller={playerController}
                  roomSettings={roomSettings}
                  isHost={isHost}
                  isFullscreen={isFullscreen}
                  areControlsVisible={areControlsVisible}
                  isLockDisabled={!isHost || Boolean(isRateLimited("UPDATE_SETTINGS"))}
                  isChangeMediaDisabled={isChangeMediaDisabled}
                  onChangeMedia={() => setIsChangeMediaOpen(true)}
                  onToggleLock={() => {
                    if (!isHost || isRateLimited("UPDATE_SETTINGS")) return;
                    updateSettings(!roomSettings.is_locked);
                  }}
                  onToggleFullscreen={toggleFullscreen}
                />
              }
              emptySlot={
                <Dropzone
                  value={mediaUrlInput}
                  onChange={setMediaUrlInput}
                  onSubmit={handleLoadMedia}
                  disabled={isChangeMediaDisabled}
                />
              }
            />

            {/* SOUS LE LECTEUR : SECTION MÉTA & ONGLETS (FILE D'ATTENTE & RÉGLAGES) */}
            {!isFullscreen && (
              <MetaSection
                mediaUrl={player.media_url}
                provider={player.provider}
                isConnected={isConnected}
                ping={myPing}
                roomSettings={roomSettings}
                isHost={isHost}
                onToggleLock={() => {
                  if (!isHost || isRateLimited("UPDATE_SETTINGS")) return;
                  updateSettings(!roomSettings.is_locked);
                }}
                isLockDisabled={!isHost || Boolean(isRateLimited("UPDATE_SETTINGS"))}
                mobileSlot={<Drawer {...sidePanelProps} />}
              />
            )}
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
