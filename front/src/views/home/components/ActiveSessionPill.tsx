import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { X } from "lucide-react";
import { sessionManager, ActiveRoomSession } from "@/lib/session";
import { roomApi } from "@/services/roomApi";

interface ActiveSessionData extends ActiveRoomSession {
  participantCount: number;
}

/**
 * Indicateur lumineux vert pulsant signalant un salon en direct.
 */
function LiveDot() {
  return (
    <span className="relative flex h-2 w-2 shrink-0">
      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
      <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
    </span>
  );
}

/**
 * Identifiant du salon et décompte direct des participants.
 */
function SessionInfo({ roomId, count }: { roomId: string; count: number }) {
  const { t } = useTranslation("global");
  const countLabel =
    count > 1
      ? t("activeSession.participants", { count })
      : t("activeSession.participant", { count });

  return (
    <div className="flex items-center gap-1.5 min-w-0 text-xs">
      <span className="text-zinc-100 font-mono font-semibold tracking-tight truncate">
        #{roomId}
      </span>
      <span className="text-zinc-500 select-none">•</span>
      <span className="text-zinc-400 font-medium truncate">{countLabel}</span>
    </div>
  );
}

/**
 * Capsule de reprise de salon actif (style Dynamic Island 40px).
 * Propose une action primaire immédiate en Cyan plein sans icône superflue.
 */
export function ActiveSessionPill() {
  const { t } = useTranslation("global");
  const navigate = useNavigate();
  const [session, setSession] = useState<ActiveSessionData | null>(null);

  useEffect(() => {
    const cached = sessionManager.getActiveRoom();
    if (!cached) return;

    roomApi
      .checkRoom(cached.roomId)
      .then((res) => {
        if (res.exists) {
          setSession({ ...cached, participantCount: res.participant_count });
        } else {
          sessionManager.clearActiveRoom();
        }
      })
      .catch(() => {
        // En cas d'indisponibilité réseau passagère, ne pas bloquer l'accueil
      });
  }, []);

  if (!session) return null;

  const handleResume = () => {
    sessionManager.setRoomSession(session.roomId, { username: session.username });
    navigate(`/room/${session.roomId}`);
  };

  const handleDismiss = () => {
    sessionManager.clearActiveRoom();
    setSession(null);
  };

  return (
    <div className="absolute top-4 sm:top-6 left-1/2 -translate-x-1/2 z-30 max-w-[calc(100%-2rem)]">
      <div className="h-10 px-3.5 sm:px-4 rounded-full bg-[#12141a]/95 border border-white/10 hover:border-white/20 backdrop-blur-md shadow-[0_4px_20px_rgba(0,0,0,0.5)] flex items-center gap-3 select-none animate-fade-in transition-all">
        <LiveDot />
        <SessionInfo roomId={session.roomId} count={session.participantCount} />

        <button
          type="button"
          onClick={handleResume}
          className="h-7 px-3 rounded-full bg-primary hover:bg-primary-hover text-zinc-950 font-bold text-xs tracking-wide transition-all shadow-[0_0_12px_rgba(10,200,185,0.35)] hover:shadow-[0_0_18px_rgba(10,200,185,0.55)] active:scale-95 cursor-pointer ml-1 shrink-0"
        >
          {t("activeSession.resume")}
        </button>

        <button
          type="button"
          onClick={handleDismiss}
          className="p-1 -mr-1 rounded-full text-zinc-500 hover:text-zinc-200 hover:bg-white/10 transition-colors cursor-pointer shrink-0"
          title={t("activeSession.dismiss")}
          aria-label={t("activeSession.dismiss")}
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

export default ActiveSessionPill;
