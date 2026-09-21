import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ArrowRight, X } from "lucide-react";
import { sessionManager, ActiveRoomSession } from "@/lib/session";
import { roomApi } from "@/services/roomApi";

interface ActiveSessionData extends ActiveRoomSession {
  participantCount: number;
}

/**
 * Indicateur lumineux vert pulsant signalant une activité en direct.
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
 * Détails du salon actif (nom du salon et décompte des participants).
 */
function SessionInfo({ roomId, count }: { roomId: string; count: number }) {
  const { t } = useTranslation("global");
  const countLabel =
    count > 1
      ? t("activeSession.participants", { count })
      : t("activeSession.participant", { count });

  return (
    <div className="flex items-center gap-1.5 min-w-0 text-zinc-300 font-mono text-[11px] sm:text-xs">
      <span className="text-emerald-400 font-semibold uppercase tracking-wider text-[10px] hidden xs:inline">
        {t("activeSession.live")} :
      </span>
      <span className="text-zinc-100 font-bold truncate">#{roomId}</span>
      <span className="text-zinc-500">•</span>
      <span className="text-zinc-400">{countLabel}</span>
    </div>
  );
}

/**
 * Capsule discrète de reprise de salon actif (style Discord / Linear).
 * Ne s'affiche QUE si un salon réel et vivant est présent en mémoire locale.
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
        // En cas d'erreur réseau, ne pas bloquer l'interface
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
      <div className="flex items-center gap-2.5 sm:gap-3 py-1.5 pl-3.5 pr-2 rounded-full bg-zinc-900/90 border border-white/10 backdrop-blur-md shadow-lg shadow-black/40 text-xs select-none animate-fade-in hover:border-white/20 transition-all">
        <LiveDot />
        <SessionInfo roomId={session.roomId} count={session.participantCount} />

        <button
          type="button"
          onClick={handleResume}
          className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-primary/15 hover:bg-primary/25 text-primary border border-primary/30 text-[11px] font-bold tracking-wide transition-all cursor-pointer active:scale-95"
        >
          <span>{t("activeSession.resume")}</span>
          <ArrowRight className="w-3 h-3" />
        </button>

        <button
          type="button"
          onClick={handleDismiss}
          className="p-1 rounded-full text-zinc-500 hover:text-zinc-300 hover:bg-white/5 transition-colors cursor-pointer"
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
