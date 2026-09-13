import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { ArrowRight, Link2, Tv } from "lucide-react";
import { PlatformBadges } from "@/components/shared/PlatformBadges";

interface RoomDropzoneProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  disabled?: boolean;
}

/**
 * Capsule d'injection centrale (état vide du lecteur 16:9).
 * Esthétique cinématographique épurée avec saisie Spotlight et auto-paste.
 */
export function RoomDropzone({ value, onChange, onSubmit, disabled }: RoomDropzoneProps) {
  const { t } = useTranslation(["room", "global"]);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-focus et écouteur de collage global (Ctrl+V / Cmd+V)
  useEffect(() => {
    const handleGlobalPaste = (e: ClipboardEvent) => {
      const activeEl = document.activeElement;
      // Ne pas intercepter si l'utilisateur est dans un autre champ (ex: chat)
      if (
        activeEl &&
        activeEl !== inputRef.current &&
        (activeEl.tagName === "INPUT" || activeEl.tagName === "TEXTAREA")
      ) {
        return;
      }
      const text = e.clipboardData?.getData("text")?.trim();
      if (text && (text.startsWith("http://") || text.startsWith("https://"))) {
        onChange(text);
        inputRef.current?.focus();
      }
    };

    window.addEventListener("paste", handleGlobalPaste);
    return () => window.removeEventListener("paste", handleGlobalPaste);
  }, [onChange]);

  return (
    <div className="flex flex-col items-center justify-center w-full max-w-lg px-4 select-none animate-fade-in text-center">
      {/* Icône et Titre de salle d'attente cinéma */}
      <div className="flex items-center justify-center w-11 h-11 rounded-full bg-white/[0.04] border border-white/10 mb-3 text-zinc-400">
        <Tv className="w-5 h-5 text-zinc-400" />
      </div>

      <h2 className="text-sm sm:text-base font-semibold text-zinc-200 tracking-tight mb-1">
        {t("player.waitingTitle", { defaultValue: "EN ATTENTE D'UN FLUX MÉDIA" })}
      </h2>
      <p className="text-xs text-zinc-500 mb-5 max-w-sm leading-relaxed">
        {t("player.waitingSubtitle", {
          defaultValue: "Collez un lien média ci-dessous pour lancer la session synchronisée.",
        })}
      </p>

      {/* Capsule de saisie Spotlight */}
      <form
        onSubmit={onSubmit}
        className="w-full flex items-center bg-zinc-900/90 border border-white/10 rounded-full p-1.5 pl-3.5 backdrop-blur-md shadow-2xl focus-within:border-[#0ac8b9]/60 focus-within:ring-1 focus-within:ring-[#0ac8b9]/30 transition-all"
      >
        <Link2 className="w-4 h-4 text-zinc-500 shrink-0 mr-2" />
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          placeholder={t("header.urlPlaceholder", {
            defaultValue: "Coller un lien média (YouTube, Twitch, URL directe...)",
          })}
          maxLength={2048}
          autoFocus
          className="flex-1 bg-transparent border-none text-xs font-mono text-zinc-100 placeholder:text-zinc-600 focus:outline-none min-w-0"
        />
        <button
          type="submit"
          disabled={disabled || !value.trim()}
          className="h-8 px-3.5 rounded-full bg-[#0ac8b9] hover:bg-[#0ac8b9]/90 text-black text-xs font-mono font-bold tracking-wider disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center gap-1.5 shrink-0 cursor-pointer shadow-sm"
        >
          <span>{t("header.load", { defaultValue: "CHARGER" })}</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </form>

      {/* Badges de plateformes supportées */}
      <PlatformBadges className="mt-4 opacity-75" />
    </div>
  );
}
