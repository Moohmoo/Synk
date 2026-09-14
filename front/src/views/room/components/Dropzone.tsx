import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Tv } from "lucide-react";
import { Omnibox, PlatformBadges } from "@/components/shared";

interface DropzoneProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  disabled?: boolean;
}

/**
 * Capsule d'injection centrale (état vide du lecteur 16:9).
 * Réutilise l'Omnibox canonique pour une harmonisation stricte avec la vue Home.
 */
export function Dropzone({ value, onChange, onSubmit, disabled }: DropzoneProps) {
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
    <div className="flex flex-col items-center justify-center w-full max-w-lg px-4 select-none animate-fade-in">
      {/* Icône et Titre de salle d'attente cinéma */}
      <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-zinc-800/80 border border-white/10 mb-3 text-zinc-300 shadow-sm">
        <Tv className="w-5 h-5" />
      </div>

      <h2 className="text-base sm:text-lg font-semibold text-zinc-100 tracking-tight mb-1.5 font-sans text-center">
        {t("player.waitingTitle", { defaultValue: "EN ATTENTE D'UN FLUX MÉDIA" })}
      </h2>
      <p className="text-xs sm:text-sm text-zinc-400 mb-6 max-w-sm leading-relaxed font-sans text-center">
        {t("player.waitingSubtitle", {
          defaultValue: "Collez un lien média ci-dessous pour lancer la session synchronisée.",
        })}
      </p>

      {/* L'Omnibox canonique (identique à l'accueil) */}
      <Omnibox
        ref={inputRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onSubmit={onSubmit}
        mode="join"
        placeholder={t("header.urlPlaceholder", {
          defaultValue: "Coller une URL de vidéo...",
        })}
        buttonText={t("header.load", { defaultValue: "CHARGER" })}
        disabled={disabled}
        submitDisabled={!value.trim()}
        maxLength={2048}
        className="w-full"
        autoFocus
      />

      {/* Badges discrets des plateformes supportées */}
      <PlatformBadges className="mt-5" />
    </div>
  );
}

export default Dropzone;
