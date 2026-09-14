import { useState, useRef, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { MessageSquare, Users, Copy, Check, Crown, Send, Wifi } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Participant, ChatMessage } from "@/types/room";
import { toast } from "@/components/ui/sonner";
import { getParticipantColor } from "@/lib/utils";

export interface RoomActivityHubProps {
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
 * Pastille discrète de statut :
 * - Vert = En ligne
 * - Jaune (pulse) = Buffering
 */
function StatusIndicator({ isBuffering }: { isBuffering: boolean }) {
  return (
    <span
      className={`w-2 h-2 rounded-full shrink-0 ${
        isBuffering
          ? "bg-amber-400 shadow-[0_0_6px_rgba(251,191,36,0.8)] animate-pulse"
          : "bg-emerald-400"
      }`}
      title={isBuffering ? "Buffering..." : "En ligne"}
    />
  );
}

/**
 * Ligne de participant individuelle avec avatar déterministe, rôle et télémétrie.
 */
function MemberRow({
  participant,
  isMe,
  playerStatus,
}: {
  participant: Participant;
  isMe: boolean;
  playerStatus?: string;
}) {
  const { t } = useTranslation("room");
  const initials = participant.username.slice(0, 2).toUpperCase();
  const color = isMe
    ? { bg: "bg-zinc-800", text: "text-zinc-300", border: "border-zinc-700" }
    : getParticipantColor(participant.id);

  // Détermination de l'état de télémétrie (Buffering si lecteur en buffer ou latence anormale)
  const isBuffering = isMe
    ? playerStatus === "buffering"
    : participant.ping_ms > 350;

  return (
    <div
      className={`flex items-center justify-between py-2 px-2.5 rounded-sm border-l-2 transition-all w-full ${
        isMe
          ? "bg-white/[0.04] border-l-zinc-600 text-white"
          : "border-l-transparent text-zinc-300 hover:bg-white/[0.02]"
      }`}
    >
      <div className="flex items-center gap-2.5 min-w-0 flex-1">
        <div
          className={`w-6 h-6 rounded-sm flex items-center justify-center text-[10px] font-mono font-bold shrink-0 border ${color.bg} ${color.text} ${color.border}`}
        >
          {initials}
        </div>
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="text-xs font-medium truncate">{participant.username}</span>
          {isMe && (
            <span className="text-[10px] text-zinc-300 font-mono shrink-0">
              {t("participants.you")}
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0 ml-2">
        {participant.is_host ? (
          <Badge variant="host" className="text-[10px] py-0.5 px-1.5 gap-1 rounded-sm font-mono">
            <Crown className="w-2.5 h-2.5 text-zinc-400" />
            <span>{t("hub.roleHost")}</span>
          </Badge>
        ) : (
          <span className="text-[10px] font-mono text-zinc-500">
            {t("hub.roleViewer")}
          </span>
        )}

        <StatusIndicator isBuffering={isBuffering} />
      </div>
    </div>
  );
}

/**
 * Activity Hub de la Room :
 * - Carte compacte Salon #ID + Bouton Inviter.
 * - Onglets Chat et Membres.
 */
export function RoomActivityHub({
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
}: RoomActivityHubProps) {
  const { t } = useTranslation(["room", "global"]);
  const [copied, setCopied] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const copyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Auto-scroll vers le bas du chat lors de nouveaux messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

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

  const handleSendChat = (e: React.FormEvent) => {
    e.preventDefault();
    const text = chatInput.trim();
    if (!text || isChatDisabled) return;
    onSendMessage(text);
    setChatInput("");
  };

  return (
    <div className="flex flex-col h-full min-h-0 select-none">
      {/* 1. CARTE COMPACTE : SALON #ID & BOUTON INVITER */}
      <div className="bg-white/[0.02] border border-white/10 rounded-md p-3 mb-3 flex items-center justify-between shrink-0">
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

      {/* 2. ONGLETS DE NAVIGATION : MEMBRES (N) & CHAT (Bientôt disponible) */}
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
              {t("platforms.comingSoon", { ns: "global", defaultValue: "Bientôt disponible" })}
            </TooltipContent>
          </Tooltip>
        </TabsList>

        {/* PANNEAU : CHAT TEMPS RÉEL */}
        <TabsContent value="chat" className="flex-1 flex flex-col min-h-0 pt-2">
          {/* Messages défilables */}
          <div className="flex-1 overflow-y-auto space-y-2.5 pr-1 min-h-0">
            {messages.length === 0 ? (
              <div className="h-full flex items-center justify-center text-center p-4">
                <p className="text-xs font-mono text-zinc-500">{t("hub.chatEmpty")}</p>
              </div>
            ) : (
              messages.map((msg) => {
                const color = getParticipantColor(msg.user_id);
                return (
                  <div key={msg.id} className="text-xs flex flex-col gap-0.5">
                    <div className="flex items-center gap-2">
                      <span className={`font-semibold font-mono text-[11px] ${color.text}`}>
                        {msg.username}
                      </span>
                      <span className="text-[10px] font-mono text-zinc-600">{msg.time}</span>
                    </div>
                    <p className="text-zinc-300 break-words text-xs leading-relaxed bg-white/[0.02] p-2 rounded-sm border border-white/5">
                      {msg.content}
                    </p>
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Saisie de message */}
          <form onSubmit={handleSendChat} className="mt-2 pt-2 border-t border-white/5 flex items-center gap-2">
            <input
              type="text"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              disabled={isChatDisabled}
              placeholder={t("hub.chatPlaceholder")}
              maxLength={500}
              className="flex-1 h-8 px-2.5 bg-black/50 border border-white/10 rounded-sm text-xs font-mono text-zinc-200 placeholder:text-zinc-500 focus:outline-none focus:border-[#0ac8b9]/50 transition-colors"
            />
            <Button
              type="submit"
              size="icon"
              variant="teal"
              disabled={isChatDisabled || !chatInput.trim()}
              className="h-8 w-8 shrink-0"
              aria-label="Envoyer le message"
            >
              <Send className="w-3.5 h-3.5" />
            </Button>
          </form>
        </TabsContent>

        {/* PANNEAU : MEMBRES (aligné en haut) */}
        <TabsContent value="members" className="flex-1 flex flex-col justify-start items-start min-h-0 pt-2 w-full">
          <div className="w-full flex flex-col justify-start space-y-1.5 pr-1 overflow-y-auto min-h-0">
            {participants.map((p) => (
              <MemberRow
                key={p.id}
                participant={p}
                isMe={currentUserId ? p.id === currentUserId : p.username === currentUsername}
                playerStatus={playerStatus}
              />
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default RoomActivityHub;
