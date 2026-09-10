import { Copy, Crown, Check } from "lucide-react";
import { useState, useRef, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Participant } from "@/types/room";
import { toast } from "@/components/ui/sonner";
import { getParticipantColor } from "@/lib/utils";

interface ParticipantItemProps {
  participant: Participant;
  isMe: boolean;
  isDuplicate: boolean;
  youLabel: string;
  hostLabel: string;
}

/**
 * Ligne de participant individuelle avec avatar coloré déterministe et badges de rôle.
 */
function ParticipantItem({
  participant,
  isMe,
  isDuplicate,
  youLabel,
  hostLabel,
}: ParticipantItemProps) {
  const initials = participant.username.slice(0, 2).toUpperCase();
  const color = isMe
    ? { bg: "bg-[#0ac8b9]/20", text: "text-[#0ac8b9]", border: "border-[#0ac8b9]/30" }
    : getParticipantColor(participant.id);

  return (
    <div
      className={`flex items-center justify-between py-1.5 px-2.5 rounded-sm border-l-[3px] transition-all duration-200 ${
        isMe
          ? "bg-gradient-to-r from-[#0ac8b9]/15 to-transparent border-l-[#0ac8b9] text-white"
          : "border-l-transparent text-zinc-300 hover:bg-white/[0.03] hover:text-white"
      }`}
    >
      <div className="flex items-center gap-2 min-w-0 flex-1">
        <div
          className={`w-6 h-6 rounded-sm flex items-center justify-center text-[10px] font-mono font-bold shrink-0 border ${color.bg} ${color.text} ${color.border}`}
        >
          {initials}
        </div>
        <div className="flex items-center gap-1 min-w-0">
          <span className="text-xs font-medium truncate">{participant.username}</span>
          {isDuplicate && (
            <span
              className="text-[9px] font-mono text-zinc-500 shrink-0"
              title={`ID: ${participant.id}`}
            >
              #{participant.id.slice(-4)}
            </span>
          )}
          {isMe && (
            <span className="text-[9px] text-[#0ac8b9] font-medium shrink-0">
              {youLabel}
            </span>
          )}
        </div>
      </div>

      {participant.is_host && (
        <Badge variant="host" className="text-[9px] py-0 px-1.5 gap-1 rounded-sm shrink-0 ml-1">
          <Crown className="w-2.5 h-2.5 text-[#0ac8b9]" />
          <span>{hostLabel}</span>
        </Badge>
      )}
    </div>
  );
}

export interface RoomSessionInfoProps {
  roomId: string;
  isConnected: boolean;
  ping?: number;
  participants: Participant[];
  currentUsername: string;
  currentUserId?: string | null;
}

export function RoomSessionInfo({
  roomId,
  isConnected,
  ping,
  participants,
  currentUsername,
  currentUserId,
}: RoomSessionInfoProps) {
  const { t } = useTranslation(["room", "global"]);
  const [copied, setCopied] = useState(false);
  const copyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
    };
  }, []);

  // Détection des homonymes (pseudos dupliqués)
  const duplicateCounts = useMemo(() => {
    return participants.reduce<Record<string, number>>((acc, p) => {
      const key = p.username.toLowerCase();
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});
  }, [participants]);

  const handleCopyLink = () => {
    if (copied) return;
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    toast.success(t("toast.success.linkCopied", { ns: "global" }), {
      id: "copy-room-link",
    });
    if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
    copyTimeoutRef.current = setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex flex-col gap-6 select-none">
      {/* MODULE : INFORMATIONS DU SALON */}
      <div>
        <div className="flex items-center justify-between mb-2.5">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
            {t("sidebar.info")}
          </div>

          {/* Statut connexion & Ping */}
          <div className="flex items-center gap-1.5">
            <div
              className={`w-1.5 h-1.5 rounded-full ${
                isConnected
                  ? "bg-[#0ac8b9] shadow-[0_0_6px_rgba(10,200,185,0.8)] animate-pulse"
                  : "bg-zinc-600"
              }`}
            />
            <span className="text-[11px] font-mono text-zinc-400">
              {isConnected && ping !== undefined && ping > 0 ? `${ping}ms` : "--"}
            </span>
          </div>
        </div>

        {/* Carte Session ID & Action d'invitation */}
        <div className="bg-white/[0.03] border border-white/10 p-3 rounded-sm flex items-center justify-between transition-colors">
          <div className="flex flex-col min-w-0 pr-2">
            <span className="text-[10px] uppercase font-mono tracking-wider text-zinc-500">
              {t("sidebar.roomId")}
            </span>
            <span className="text-sm font-mono font-bold text-white tracking-widest truncate">
              {roomId}
            </span>
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={handleCopyLink}
            disabled={copied}
            className="h-7 px-2.5 text-xs gap-1.5 font-medium rounded-sm border-white/10 hover:border-[#0ac8b9]/40 hover:text-[#0ac8b9] shrink-0 transition-all cursor-pointer disabled:opacity-80"
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

      {/* MODULE : MEMBRES */}
      <div>
        <div className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500 mb-3">
          {t("sidebar.members", { count: participants.length })}
        </div>

        <div className="space-y-1.5 max-h-[300px] overflow-y-auto pr-1">
          {participants.map((p) => (
            <ParticipantItem
              key={p.id}
              participant={p}
              isMe={currentUserId ? p.id === currentUserId : p.username === currentUsername}
              isDuplicate={(duplicateCounts[p.username.toLowerCase()] || 0) > 1}
              youLabel={t("participants.you")}
              hostLabel={t("participants.host")}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
