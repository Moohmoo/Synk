import React, { useState, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Settings, Subtitles, PictureInPicture2, Activity } from "lucide-react";
import { PlayerController } from "@/hooks/usePlayer";
import { cn } from "@/lib/utils";

interface PlayerSettingsMenuProps {
  controller: PlayerController;
  ping?: number;
}

/**
 * Menu contextuel sobre pour les réglages individuels du joueur :
 * - Sous-titres (CC) avec raccourci clavier C
 * - Mini-lecteur (Picture-in-Picture)
 * - Télémétrie temps réel (Ping & Dérive)
 */
export function PlayerSettingsMenu({ controller, ping }: PlayerSettingsMenuProps) {
  const { t } = useTranslation("room");
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const {
    currentTime,
    roomTime,
    subtitlesEnabled,
    toggleSubtitles,
    isPiPSupported,
    isPiPActive,
    togglePictureInPicture,
  } = controller;

  // Le Picture-in-Picture W3C n'est pas autorisé par les navigateurs sur les iframes cross-origin (YouTube/Twitch)
  const isIframeProvider = controller.provider === "youtube" || controller.provider === "twitch";
  const canUsePiP = isPiPSupported && !isIframeProvider;

  // Calcul du décalage temps réel en secondes
  const drift = Math.max(0, Math.abs(currentTime - roomTime));

  // Fermeture automatique au clic à l'extérieur ou touche Échap
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsOpen(false);
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  const pingColor =
    ping === undefined
      ? "bg-zinc-500"
      : ping < 100
      ? "bg-emerald-400"
      : ping < 250
      ? "bg-amber-400"
      : "bg-rose-500";

  return (
    <div ref={menuRef} className="relative">
      {/* Bouton déclencheur ⚙️ */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className={cn(
          "p-1.5 transition-colors cursor-pointer rounded-sm",
          isOpen ? "text-cyan-400 bg-white/10" : "text-white/80 hover:text-white"
        )}
        title={t("controls.options")}
        aria-label={t("controls.options")}
        aria-expanded={isOpen}
      >
        <Settings className={cn("w-4 h-4 transition-transform duration-300", isOpen && "rotate-45")} />
      </button>

      {/* Popover compact ancré au-dessus du bouton */}
      {isOpen && (
        <div className="absolute bottom-full right-0 mb-2.5 z-30 w-64 p-3 bg-[#0c0c0e]/95 backdrop-blur-md border border-white/10 rounded-lg shadow-2xl flex flex-col gap-2 text-xs select-none pointer-events-auto">
          {/* En-tête */}
          <div className="flex items-center gap-1.5 pb-1 border-b border-white/10 text-zinc-300 font-semibold">
            <Settings className="w-3.5 h-3.5 text-cyan-400" />
            <span>{t("controls.options")}</span>
          </div>

          {/* Option 1 : Sous-titres */}
          <button
            type="button"
            onClick={toggleSubtitles}
            className="flex items-center justify-between p-1.5 rounded hover:bg-white/5 transition-colors text-left cursor-pointer group"
          >
            <div className="flex items-center gap-2 text-zinc-300 group-hover:text-white">
              <Subtitles className="w-4 h-4 text-zinc-400 group-hover:text-cyan-400" />
              <span>{t("controls.subtitles")}</span>
              <kbd className="px-1 py-0.2 text-[9px] font-mono bg-white/10 text-zinc-400 rounded">C</kbd>
            </div>
            <span
              className={cn(
                "font-mono font-medium text-[11px]",
                subtitlesEnabled ? "text-cyan-400" : "text-zinc-500"
              )}
            >
              {subtitlesEnabled ? t("controls.enabled") : t("controls.disabled")}
            </span>
          </button>

          {/* Option 2 : Mini-lecteur (PiP) */}
          <button
            type="button"
            onClick={togglePictureInPicture}
            disabled={!canUsePiP}
            className="flex items-center justify-between p-1.5 rounded hover:bg-white/5 disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-left cursor-pointer group"
          >
            <div className="flex items-center gap-2 text-zinc-300 group-hover:text-white">
              <PictureInPicture2 className="w-4 h-4 text-zinc-400 group-hover:text-cyan-400" />
              <span>{t("controls.pip")}</span>
            </div>
            <span
              className={cn(
                "font-mono font-medium text-[11px]",
                isPiPActive ? "text-cyan-400" : "text-zinc-500"
              )}
            >
              {!canUsePiP
                ? t("controls.disabled")
                : isPiPActive
                ? t("controls.pipExit")
                : t("controls.enabled")}
            </span>
          </button>

          {/* Section 3 : Télémétrie en direct */}
          <div className="pt-1.5 border-t border-white/10 flex flex-col gap-1.5">
            <div className="flex items-center gap-1.5 text-[10px] text-zinc-500 font-mono uppercase tracking-wider">
              <Activity className="w-3 h-3 text-cyan-400" />
              <span>{t("controls.telemetry")}</span>
            </div>
            <div className="grid grid-cols-2 gap-2 bg-white/5 rounded p-2 text-zinc-300 font-mono text-[11px]">
              <div className="flex items-center gap-1.5">
                <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", pingColor)} />
                <span className="text-zinc-400">{t("controls.ping")}:</span>
                <span className="font-semibold text-white">{ping !== undefined ? `${ping}ms` : "--"}</span>
              </div>
              <div className="flex items-center justify-end gap-1.5">
                <span className="text-zinc-400">{t("controls.drift")}:</span>
                <span className="font-semibold text-white">{drift.toFixed(2)}s</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
