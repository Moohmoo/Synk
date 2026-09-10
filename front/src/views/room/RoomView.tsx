import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useParams, useNavigate, Navigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Tv, Link2, Users } from "lucide-react";
import { Omnibox } from "@/components/shared";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { RightSidebarSlot } from "@/components/RightSidebarSlot";
import { roomApi } from "@/services/roomApi";
import { sessionManager } from "@/lib/session";
import { useSyncRoom } from "@/hooks/useSyncRoom";
import { toast } from "@/components/ui/sonner";
import { useUIStore } from "@/stores/uiStore";
import { MediaPlayer } from "./components/MediaPlayer";
import { PlayerControls } from "./components/PlayerControls";
import { RoomSessionInfo } from "./components/RoomSessionInfo";
import { usePlayerController } from "@/hooks/usePlayerController";
import { useCinemaMode } from "@/hooks/useCinemaMode";

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
  const [mediaUrlInput, setMediaUrlInput] = useState("");
  const [isChangeMediaOpen, setIsChangeMediaOpen] = useState(false);
  const [isMobileInfoOpen, setIsMobileInfoOpen] = useState(false);

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

  // Contrôleur unifié du lecteur multimédia (temps, lecture, rattrapage, durée)
  const playerController = usePlayerController({
    player,
    isHost,
    isLocked: roomSettings.is_locked,
    isRateLimited,
    sendPlay,
    sendPause,
    sendSeek,
  });

  // Contrôles locaux du lecteur (Volume local & Plein écran)
  const [volume, setVolume] = useState<number>(() => {
    const saved = localStorage.getItem("synk_volume");
    return saved !== null ? Number(saved) : 100;
  });
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const cinemaContainerRef = useRef<HTMLDivElement>(null);

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

  const effectiveUserId = currentUserId || userId;
  const isLockedForGuest = roomSettings.is_locked && !isHost;

  // Ergonomie cinéma unifiée : plein écran, auto-hide des contrôles et raccourcis universels
  const { isFullscreen, areControlsVisible, toggleFullscreen, resetControlsTimeout } =
    useCinemaMode({
      containerRef: cinemaContainerRef,
      controller: playerController,
      volume,
      isMuted,
      onVolumeChange: handleVolumeChange,
      onToggleMute: handleToggleMute,
      onChangeMedia: () => {
        if (!isLockedForGuest && !isRateLimited("CHANGE_MEDIA")) {
          setIsChangeMediaOpen((open) => !open);
        }
      },
    });

  const handleLoadMedia = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanUrl = mediaUrlInput.trim();
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
    setMediaUrlInput("");
    setIsChangeMediaOpen(false);
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

  {/*
    Dropzone d'accueil (en attente d'un média) :
    Optimisée avec des marges et icônes compactes sur mobile (< 640px), garantissant
    que l'Omnibox et les badges de compatibilité respirent sans déborder de l'écran.
  */}
  const emptyDropzone = (
    <div className="flex flex-col items-center w-full max-w-xl px-3 sm:px-4 select-none">
      <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-zinc-900/80 border border-white/10 flex items-center justify-center mb-2 sm:mb-4 shadow-inner">
        <Tv className="w-5 h-5 sm:w-6 sm:h-6 text-[#0ac8b9]" />
      </div>
      <h2 className="text-xs sm:text-sm font-mono font-bold tracking-widest uppercase text-zinc-300 mb-1">
        {t("player.waitingTitle")}
      </h2>
      <p className="text-[10px] sm:text-[11px] font-mono text-zinc-500 mb-3 sm:mb-6 text-center">
        {t("player.waitingSubtitle")}
      </p>

      <Omnibox
        value={mediaUrlInput}
        onChange={(e) => setMediaUrlInput(e.target.value)}
        onSubmit={handleLoadMedia}
        mode="join"
        placeholder={t("header.urlPlaceholder")}
        buttonText={t("header.load")}
        disabled={isLockedForGuest || isRateLimited("CHANGE_MEDIA")}
        maxLength={2048}
        className="w-full relative z-20 shadow-2xl"
        autoFocus
      />

      <div className="flex flex-wrap items-center justify-center gap-1.5 sm:gap-2 mt-3 sm:mt-5 text-[9px] sm:text-[10px] font-mono text-zinc-500 uppercase tracking-wider">
        <span className="px-2 py-0.5 rounded bg-zinc-900/60 border border-white/5">YouTube</span>
        <span className="px-2 py-0.5 rounded bg-zinc-900/60 border border-white/5">Twitch</span>
        <span className="px-2 py-0.5 rounded bg-zinc-900/60 border border-white/5">Vimeo</span>
        <span className="px-2 py-0.5 rounded bg-zinc-900/60 border border-white/5">Direct / HLS</span>
      </div>
    </div>
  );

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

      <div className="flex-1 flex flex-col items-center justify-start min-w-0 w-full">
        {/* Accès rapide aux informations du salon (Mobile & Tablette < 1280px) */}
        {!isFullscreen && (
          <div className="xl:hidden w-full max-w-4xl flex items-center justify-end mb-2.5">
            <Sheet open={isMobileInfoOpen} onOpenChange={setIsMobileInfoOpen}>
              <SheetTrigger asChild>
                <button
                  type="button"
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#141417]/90 border border-white/10 text-xs font-mono hover:bg-[#27272a] hover:border-white/20 transition-all cursor-pointer shadow-sm"
                  aria-label={t("sidebar.info")}
                >
                  <div
                    className={`w-1.5 h-1.5 rounded-full ${
                      isConnected
                        ? "bg-[#0ac8b9] shadow-[0_0_6px_#0ac8b9] animate-pulse"
                        : "bg-zinc-600"
                    }`}
                  />
                  <span className="text-[#0ac8b9] font-bold">#{roomId}</span>
                  <span className="text-zinc-600">|</span>
                  <span className="text-zinc-300 flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-zinc-400" />
                    <span>{participants.length}</span>
                  </span>
                </button>
              </SheetTrigger>
              <SheetContent side="right" className="w-80 p-6 overflow-y-auto">
                <SheetHeader className="mb-4">
                  <SheetTitle>{t("sidebar.info")}</SheetTitle>
                </SheetHeader>
                <RoomSessionInfo
                  roomId={roomId}
                  isConnected={isConnected}
                  ping={myPing}
                  participants={participants}
                  currentUsername={currentUsername}
                  currentUserId={effectiveUserId}
                />
              </SheetContent>
            </Sheet>
          </div>
        )}

        {/* ESPACE CINÉMA UNIFIÉ : Lecteur & Barre de Contrôle */}
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
          {/* LE LECTEUR MULTIMÉDIA : Conteneur Cinéma Universel */}
          <MediaPlayer
            controller={playerController}
            volume={volume}
            isMuted={isMuted}
            isFullscreen={isFullscreen}
            onToggleFullscreen={toggleFullscreen}
            emptySlot={emptyDropzone}
          />

          {/* Dégradé immersif en bas d'écran (Plein écran uniquement) pour la lisibilité des contrôles */}
          {isFullscreen && (
            <div
              className={`absolute inset-x-0 bottom-0 h-36 bg-gradient-to-t from-black/90 via-black/40 to-transparent pointer-events-none transition-opacity duration-300 z-20 ${
                areControlsVisible ? "opacity-100" : "opacity-0"
              }`}
            />
          )}

          {/* 
            Barre de Contrôle du Lecteur & Verrou d'hôte :
            - En mode normal : disposée directement sous le lecteur.
            - En mode plein écran : superposition flottante (overlay) avec auto-hide après 3s d'inactivité.
          */}
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
              isChangeMediaDisabled={isLockedForGuest || Boolean(isRateLimited("CHANGE_MEDIA"))}
              onChangeMedia={() => setIsChangeMediaOpen(true)}
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
      </div>

      {/* 
        Palette de commande (Modale) pour changer de média en cours de session :
        Largeur adaptative avec gouttière de sécurité sur mobile (w-[calc(100%-2rem)])
        pour éviter le contact bord à bord sur écran étroit.
      */}
      <Dialog open={isChangeMediaOpen} onOpenChange={setIsChangeMediaOpen}>
        <DialogContent className="w-[calc(100%-2rem)] sm:max-w-xl bg-[#141417]/95 border-white/10 backdrop-blur-xl p-4 sm:p-6 rounded-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-sm font-mono tracking-wider text-white">
              <Link2 className="w-4 h-4 text-[#0ac8b9]" />
              <span>{t("header.changeMediaTitle")}</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-zinc-400 font-sans">
              {t("header.changeMediaSubtitle")}
            </DialogDescription>
          </DialogHeader>

          <div className="mt-2">
            <Omnibox
              value={mediaUrlInput}
              onChange={(e) => setMediaUrlInput(e.target.value)}
              onSubmit={handleLoadMedia}
              mode="join"
              placeholder={t("header.urlPlaceholder")}
              buttonText={t("header.load")}
              disabled={isLockedForGuest || isRateLimited("CHANGE_MEDIA")}
              maxLength={2048}
              className="w-full relative z-20"
              autoFocus
            />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
