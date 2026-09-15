import { Globe } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export interface LanguageSwitcherProps {
  showGlobe?: boolean;
  compact?: boolean;
  className?: string;
}

/**
 * Sélecteur de langue bilingue (Français / Anglais).
 * - Mode étendu : icône Globe discrète + boutons textes FR / EN.
 * - Mode compact : bouton iconique avec bascule instantanée et tooltip contextuel.
 */
export function LanguageSwitcher({
  showGlobe = false,
  compact = false,
  className,
}: LanguageSwitcherProps) {
  const { i18n, t } = useTranslation("global");
  const currentLang = i18n.language?.startsWith("en") ? "en" : "fr";

  const changeLanguage = (lang: string) => {
    if (currentLang === lang) return;
    void i18n.changeLanguage(lang);
  };

  const toggleLanguage = () => {
    const nextLang = currentLang === "fr" ? "en" : "fr";
    void i18n.changeLanguage(nextLang);
  };

  if (compact) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={toggleLanguage}
            className={cn(
              "relative flex items-center justify-center w-10 h-10 rounded-md text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.04] transition-colors cursor-pointer",
              className
            )}
            aria-label={t(currentLang === "fr" ? "nav.switchLanguageEn" : "nav.switchLanguageFr")}
          >
            <Globe className="w-4 h-4" />
            <span className="absolute bottom-1 right-1 text-[8px] font-mono font-bold uppercase text-zinc-400">
              {currentLang}
            </span>
          </button>
        </TooltipTrigger>
        <TooltipContent side="right" sideOffset={10}>
          {currentLang === "fr" ? "Passer en anglais (EN)" : "Switch to French (FR)"}
        </TooltipContent>
      </Tooltip>
    );
  }

  return (
    <div className={cn("flex items-center font-mono text-xs select-none", className)}>
      {showGlobe && <Globe className="w-3.5 h-3.5 text-zinc-500 mr-1.5 shrink-0" />}
      <button
        type="button"
        onClick={() => changeLanguage("fr")}
        aria-label={t("nav.switchLanguageFr")}
        className={cn(
          "transition-colors cursor-pointer",
          currentLang === "fr"
            ? "text-zinc-200 font-medium"
            : "text-zinc-500 hover:text-zinc-300"
        )}
      >
        FR
      </button>
      <span className="mx-1.5 text-zinc-700" aria-hidden="true">
        /
      </span>
      <button
        type="button"
        onClick={() => changeLanguage("en")}
        aria-label={t("nav.switchLanguageEn")}
        className={cn(
          "transition-colors cursor-pointer",
          currentLang === "en"
            ? "text-zinc-200 font-medium"
            : "text-zinc-500 hover:text-zinc-300"
        )}
      >
        EN
      </button>
    </div>
  );
}

export default LanguageSwitcher;
