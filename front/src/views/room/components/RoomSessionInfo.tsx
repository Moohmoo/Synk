import { Copy, Crown, Check } from "lucide-react";
import { useState, useRef, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
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
      className={`flex items-center justify-between p-2 rounded-lg border transition-colors ${
        isMe
          ? "bg-[#141417] border-[#0ac8b9]/25 text-white"
          : "bg-[#141417]/50 border-white/5 text-zinc-300 hover:bg-[#141417]"
      }`}
    >
      <div className="flex items-center gap-2.5 min-w-0">
        <div
          className={`w-6 h-6 rounded-md flex items-center justify-center text-[10px] font-mono font-bold shrink-0 border ${color.bg} ${color.text} ${color.border}`}
        >
          {initials}
        </div>
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="text-xs font-medium truncate">{participant.username}</span>
          {isDuplicate && (
            <span
              className="text-[10px] font-mono text-zinc-500 shrink-0"
              title={`ID: ${participant.id}`}
            >
              #{participant.id.slice(-4)}
            </span>
          )}
          {isMe && (
            <span className="text-[10px] text-[#0ac8b9] font-sans font-medium shrink-0">
              {youLabel}
            </span>
          )}
        </div>
      </div>

      {participant.is_host && (
        <Badge variant="host" className="text-[9px] py-0 px-1.5 gap-1 rounded">
          <Crown className="w-2.5 h-2.5 text-[#0ac8b9]" />
          <span>{hostLabel}</span>
        </Badge>
      )}
    </div>
  );
}

interface RoomSessionInfoProps {
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
      {/* MODULE : INFORMATIONS */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
            {t("sidebar.info")}
          </div>

          {/* Statut connexion & Ping */}
          <div className="flex items-center gap-1.5">
            <div
              className={`w-1.5 h-1.5 rounded-full ${
                isConnected
                  ? "bg-[#0ac8b9] shadow-[0_0_8px_rgba(10,200,185,0.8)] animate-pulse"
                  : "bg-zinc-600"
              }`}
            />
            <span className="text-[11px] font-mono text-zinc-400">
              Ping :{" "}
              <span className="text-zinc-200">
                {isConnected && ping !== undefined && ping > 0 ? `${ping}ms` : "--"}
              </span>
            </span>
          </div>
        </div>

        <div className="bg-[#141417] border border-white/5 p-3.5 rounded-xl flex items-center justify-between">
          <div className="flex flex-col min-w-0">
            <span className="text-[10px] uppercase font-mono tracking-wider text-zinc-500">
              {t("sidebar.roomId")}
            </span>
            <span className="text-base font-mono font-bold text-white tracking-widest truncate">
              {roomId}
            </span>
          </div>
          <button
            type="button"
            onClick={handleCopyLink}
            disabled={copied}
            className="p-1.5 rounded-md hover:bg-white/10 text-zinc-500 hover:text-white transition-colors cursor-pointer shrink-0 ml-2 disabled:opacity-50 disabled:cursor-default"
            title={t("sidebar.copyTooltip")}
          >
            {copied ? (
              <Check className="w-4 h-4 text-emerald-400" />
            ) : (
              <Copy className="w-4 h-4" />
            )}
          </button>
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
