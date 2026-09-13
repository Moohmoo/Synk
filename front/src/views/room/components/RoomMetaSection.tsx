import { useTranslation } from "react-i18next";
import { Lock, Unlock, Radio, ListVideo, SlidersHorizontal, CheckCircle2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { RoomSettings } from "@/types/room";

interface RoomMetaSectionProps {
  mediaUrl?: string | null;
  provider?: string | null;
  isConnected: boolean;
  ping?: number;
  roomSettings: RoomSettings;
  isHost: boolean;
  onToggleLock?: () => void;
  isLockDisabled?: boolean;
  mobileSlot?: React.ReactNode;
}

/**
 * Extrait un titre lisible ou nettoyé depuis l'URL du média.
 */
function getMediaDisplayTitle(mediaUrl?: string | null): string | null {
  if (!mediaUrl) return null;
  try {
    const url = new URL(mediaUrl);
    if (url.hostname.includes("youtube.com") || url.hostname.includes("youtu.be")) {
      const v = url.searchParams.get("v");
      return v ? `YouTube: ${v}` : "Vidéo YouTube";
    }
    if (url.hostname.includes("twitch.tv")) {
      const channel = url.pathname.replace(/^\//, "");
      return channel ? `Twitch: ${channel}` : "Live Twitch";
    }
    const filename = url.pathname.split("/").pop();
    return filename || url.hostname;
  } catch {
    return mediaUrl;
  }
}

/**
 * Section méta et conteneur d'onglets légers sous le lecteur vidéo 16:9.
 */
export function RoomMetaSection({
  mediaUrl,
  provider,
  isConnected,
  ping,
  roomSettings,
  isHost,
  onToggleLock,
  isLockDisabled = false,
  mobileSlot,
}: RoomMetaSectionProps) {
  const { t } = useTranslation("room");
  const displayTitle = getMediaDisplayTitle(mediaUrl);

  return (
    <div className="w-full p-4 sm:p-6 flex flex-col gap-4 select-none animate-fade-in">
      {/* 1. Ligne Méta : Titre du média et Badges d'état de la salle */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-white/5">
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          <Radio className={`w-4 h-4 ${isConnected ? "text-emerald-400" : "text-zinc-400"} shrink-0`} />
          <h1 className="text-sm sm:text-base font-semibold text-zinc-100 truncate tracking-tight">
            {displayTitle || t("meta.noMedia")}
          </h1>
          {provider && (
            <span className="hidden sm:inline-block px-1.5 py-0.5 rounded bg-white/5 text-[10px] font-mono text-zinc-400 uppercase">
              {provider}
            </span>
          )}
        </div>

        {/* Badges d'état de la salle & Déclencheur Mobile */}
        <div className="flex items-center gap-2 shrink-0">
          {mobileSlot}

          {/* Badge Contrôle Hôte / Libre */}
          {roomSettings.is_locked ? (
            <Badge className="bg-zinc-900 border border-zinc-800 text-zinc-300 text-xs py-1 px-2.5 gap-1.5">
              <Lock className="w-3.5 h-3.5 text-zinc-400" />
              <span>{t("meta.hostControl")}</span>
            </Badge>
          ) : (
            <Badge className="bg-zinc-900 border border-zinc-800 text-zinc-300 text-xs py-1 px-2.5 gap-1.5">
              <Unlock className="w-3.5 h-3.5 text-zinc-400" />
              <span>{t("meta.freeControl")}</span>
            </Badge>
          )}
        </div>
      </div>

      {/* 2. Conteneur d'onglets légers : Réglages (Actif) & File d'attente (Bientôt disponible) */}
      <Tabs defaultValue="settings" className="w-full">
        <TabsList className="bg-transparent border-b border-white/5 justify-start h-9 p-0 gap-6 w-full">
          <TabsTrigger
            value="settings"
            className="flex-none flex items-center gap-2 px-1 pb-2 text-xs font-mono uppercase bg-transparent text-zinc-500 hover:text-zinc-300 data-[state=active]:text-white data-[state=active]:bg-transparent border-b-2 border-transparent data-[state=active]:border-cyan-400 after:hidden rounded-none -mb-px transition-colors"
          >
            <SlidersHorizontal className="w-3.5 h-3.5 text-inherit" />
            <span>{t("meta.tabSettings")}</span>
          </TabsTrigger>

          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center">
                <TabsTrigger
                  value="queue"
                  disabled
                  className="flex-none flex items-center gap-1.5 px-1 pb-2 text-xs font-mono uppercase bg-transparent text-zinc-500 hover:text-zinc-300 border-b-2 border-transparent cursor-not-allowed opacity-50 select-none pointer-events-none after:hidden rounded-none -mb-px"
                >
                  <ListVideo className="w-3.5 h-3.5 text-inherit" />
                  <span>{t("meta.tabQueue")}</span>
                  <span className="text-[9px] font-mono px-1 py-0.2 rounded bg-white/10 text-zinc-400">
                    SOON
                  </span>
                </TabsTrigger>
              </div>
            </TooltipTrigger>
            <TooltipContent side="top" sideOffset={6}>
              {t("platforms.comingSoon", { ns: "global", defaultValue: "Bientôt disponible" })}
            </TooltipContent>
          </Tooltip>
        </TabsList>

        {/* Contenu Onglet : File d'attente */}
        <TabsContent value="queue" className="pt-3">
          <div className="bg-black/30 border border-white/5 rounded-md p-4 flex flex-col gap-3">
            {mediaUrl ? (
              <div className="flex items-center justify-between p-2.5 bg-white/[0.02] border border-white/10 rounded-sm">
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="text-[10px] font-mono font-bold text-zinc-300 uppercase px-1.5 py-0.5 bg-zinc-800 border border-zinc-700 rounded">
                    EN COURS
                  </span>
                  <span className="text-xs font-medium text-zinc-200 truncate">{displayTitle}</span>
                </div>
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              </div>
            ) : null}

            <div className="text-center py-5 border border-dashed border-white/5 rounded-sm">
              <p className="text-xs font-mono text-zinc-400 mb-1">{t("meta.queueEmptyTitle")}</p>
              <p className="text-[11px] text-zinc-600">{t("meta.queueEmptyDesc")}</p>
            </div>
          </div>
        </TabsContent>

        {/* Contenu Onglet : Réglages de synchronisation */}
        <TabsContent value="settings" className="pt-3">
          <div className="bg-black/30 border border-white/5 rounded-md p-4 flex flex-col gap-4">
            {/* Contrôle de verrouillage de la session */}
            <div className="flex items-center justify-between pb-3 border-b border-white/5">
              <div className="flex flex-col pr-4">
                <span className="text-xs font-semibold text-zinc-200">{t("meta.settingsLockTitle")}</span>
                <span className="text-[11px] text-zinc-500 mt-0.5">{t("meta.settingsLockDesc")}</span>
              </div>
              {isHost ? (
                <Button
                  variant={roomSettings.is_locked ? "destructive" : "secondary"}
                  size="sm"
                  disabled={isLockDisabled}
                  onClick={onToggleLock}
                  className="h-8 px-3 text-xs gap-1.5 shrink-0"
                >
                  {roomSettings.is_locked ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
                  <span>{roomSettings.is_locked ? t("meta.hostControl") : t("meta.freeControl")}</span>
                </Button>
              ) : (
                <Badge className="bg-zinc-900 border border-zinc-800 text-zinc-300 text-xs shrink-0 py-1 px-2.5 gap-1.5">
                  {roomSettings.is_locked ? `${t("meta.hostControl")} (Hôte)` : t("meta.freeControl")}
                </Badge>
              )}
            </div>

            {/* Télémétrie et moteur de synchro */}
            <div className="flex items-center justify-between text-xs font-mono text-zinc-400">
              <div className="flex flex-col">
                <span className="text-xs font-semibold font-sans text-zinc-200">{t("meta.settingsLatencyTitle")}</span>
                <span className="text-[11px] font-sans text-zinc-500 mt-0.5">{t("meta.settingsLatencyDesc")}</span>
              </div>
              <div className="flex items-center gap-2 font-mono shrink-0">
                <span className="text-[11px] text-zinc-400">RTT:</span>
                <span className="text-xs text-zinc-400 font-medium">{ping !== undefined && ping > 0 ? `${ping}ms` : "--"}</span>
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
