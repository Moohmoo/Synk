import { useTranslation } from "react-i18next";
import { Crown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Participant } from "@/types/room";
import { getParticipantColor } from "@/lib/utils";

interface StatusIndicatorProps {
  isBuffering: boolean;
  title?: string;
}

/**
 * Pastille discrète de statut :
 * - Vert = En ligne
 * - Jaune (pulse) = Buffering
 */
function StatusIndicator({ isBuffering, title }: StatusIndicatorProps) {
  return (
    <span
      className={`w-2 h-2 rounded-full shrink-0 ${
        isBuffering
          ? "bg-amber-400 shadow-[0_0_6px_rgba(251,191,36,0.8)] animate-pulse"
          : "bg-emerald-400"
      }`}
      title={title}
    />
  );
}

interface MemberRowProps {
  participant: Participant;
  isMe: boolean;
  playerStatus?: string;
}

/**
 * Ligne de participant individuelle avec avatar déterministe, rôle et télémétrie.
 */
function MemberRow({ participant, isMe, playerStatus }: MemberRowProps) {
  const { t } = useTranslation("room");
  const initials = participant.username.slice(0, 2).toUpperCase();
  const color = isMe
    ? { bg: "bg-zinc-800", text: "text-zinc-300", border: "border-zinc-700" }
    : getParticipantColor(participant.id);

  // Buffering si lecteur en buffer ou latence anormale (> 350ms)
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

        <StatusIndicator
          isBuffering={isBuffering}
          title={isBuffering ? t("hub.statusBuffering") : t("hub.statusOnline")}
        />
      </div>
    </div>
  );
}

export interface RoomMembersProps {
  participants: Participant[];
  currentUsername: string;
  currentUserId?: string | null;
  playerStatus?: string;
}

/**
 * Liste des participants du salon avec statut de synchronisation en direct.
 */
export function RoomMembers({
  participants,
  currentUsername,
  currentUserId,
  playerStatus,
}: RoomMembersProps) {
  return (
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
  );
}

export default RoomMembers;
