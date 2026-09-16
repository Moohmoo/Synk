import { useState, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { MessageSquare, Users, Copy, Check, Wifi } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Participant, ChatMessage } from "@/types/room";
import { toast } from "@/components/ui/sonner";
import { Members } from "./Members";
import { Chat } from "./Chat";

export interface SidePanelProps {
  roomId: string;
  isConnected: boolean;
  ping?: number;
  participants: Participant[];
  currentUsername: string;
  currentUserId?: string | null;
  messages: ChatMessage[];
  onSendMessage: (content: string) => void;
  playerStatus?: string;
  isChatDisabled?: boolean;
}

/**
 * Panneau latéral droit de la salle :
 * - En-tête : Récapitulatif salon #ID + bouton inviter.
 * - Onglets : Membres et Chat temps réel.
 */
export function SidePanel({
  roomId,
  isConnected,
  ping,
  participants,
  currentUsername,
  currentUserId,
  messages,
  onSendMessage,
  playerStatus,
  isChatDisabled = false,
}: SidePanelProps) {
  const { t } = useTranslation(["room", "global"]);
  const [copied, setCopied] = useState(false);
  const copyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
    };
  }, []);

  const handleCopyLink = () => {
    if (copied) return;
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    toast.success(t("toast.success.linkCopied", { ns: "global" }), { id: "copy-room-link" });
    if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
    copyTimeoutRef.current = setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex flex-col h-full min-h-0 select-none">
      {/* 1. ONGLETS : MEMBRES & CHAT */}
      <Tabs defaultValue="members" className="flex-1 flex flex-col min-h-0">
        <TabsList className="h-9 p-0 bg-zinc-950/60 border-b border-white/10 shrink-0 flex items-center">
          <TabsTrigger
            value="members"
            className="flex-1 flex items-center justify-center gap-2 text-xs font-mono uppercase tracking-wider text-zinc-400 data-[state=active]:text-white"
          >
            <Users className="w-3.5 h-3.5" />
            <span>{t("hub.tabMembers", { count: participants.length })}</span>
          </TabsTrigger>

          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex-1">
                <TabsTrigger
                  value="chat"
                  disabled
                  className="w-full flex items-center justify-center gap-1.5 text-xs font-mono uppercase tracking-wider cursor-not-allowed opacity-50 select-none pointer-events-none"
                >
                  <MessageSquare className="w-3.5 h-3.5 text-zinc-500" />
                  <span>{t("hub.tabChat")}</span>
                  <span className="text-[10px] font-mono font-medium px-1.5 py-0.5 rounded bg-white/10 text-zinc-400">
                    SOON
                  </span>
                </TabsTrigger>
              </div>
            </TooltipTrigger>
            <TooltipContent side="top" sideOffset={6}>
              {t("common.comingSoon", { ns: "global", defaultValue: "Bientôt disponible" })}
            </TooltipContent>
          </Tooltip>
        </TabsList>

        <TabsContent value="members" className="flex-1 flex flex-col justify-start items-start min-h-0 pt-2 w-full">
          <Members
            participants={participants}
            currentUsername={currentUsername}
            currentUserId={currentUserId}
            playerStatus={playerStatus}
          />
        </TabsContent>

        <TabsContent value="chat" className="flex-1 flex flex-col min-h-0 pt-2">
          <Chat
            messages={messages}
            onSendMessage={onSendMessage}
            isChatDisabled={isChatDisabled}
          />
        </TabsContent>
      </Tabs>

      {/* 2. CARTE SALON : ID, PING & BOUTON INVITER (AU-DESSUS DU FOOTER) */}
      <div className="bg-white/[0.02] border border-white/10 rounded-md p-3 mt-3 flex items-center justify-between shrink-0">
        <div className="flex flex-col min-w-0 pr-2">
          <div className="flex items-center gap-1.5 text-[10px] font-mono uppercase text-zinc-400 mb-0.5">
            <Wifi className={`w-3 h-3 ${isConnected ? "text-emerald-400" : "text-zinc-500"}`} />
            <span>{isConnected ? `${ping || 0}ms` : t("sidebar.disconnected")}</span>
          </div>
          <span className="text-xs font-mono font-bold text-white tracking-wider truncate">
            #{roomId}
          </span>
        </div>

        <Button
          variant="secondary"
          size="sm"
          onClick={handleCopyLink}
          disabled={copied}
          className="h-7 px-2.5 text-xs gap-1.5 font-medium rounded-sm border-white/10 hover:border-white/20 hover:text-white shrink-0 transition-all cursor-pointer disabled:opacity-80"
          title={t("sidebar.copyTooltip")}
        >
          {copied ? (
            <>
              <Check className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-emerald-400 font-mono text-[11px]">{t("sidebar.copied")}</span>
            </>
          ) : (
            <>
              <Copy className="w-3.5 h-3.5" />
              <span>{t("sidebar.invite")}</span>
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

export default SidePanel;
