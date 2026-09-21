import { Settings, Github, ExternalLink } from "lucide-react";
import { useTranslation } from "react-i18next";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { SynkIcon } from "@/components/SynkIcon";
import { GITHUB_REPO_URL } from "@/lib/constants";
import { cn } from "@/lib/utils";

export interface SidebarSettingsProps {
  isCollapsed?: boolean;
  className?: string;
}

/**
  * Pied de la barre latérale gauche.
  * Structure ordonnée :
  * 1. Au-dessus : Identité de l'application (SYNK v1.0.0-beta) et lien GitHub.
  * 2. En-dessous : Préférences utilisateur (Sélecteur de langue FR/EN et réglages).
 */
export function SidebarSettings({ isCollapsed = false, className }: SidebarSettingsProps) {
  const { t } = useTranslation("global");
  const comingSoonText = t("common.comingSoon");
  const ariaLabel = `${t("nav.settings")} (${comingSoonText})`;

  if (isCollapsed) {
    return (
      <div className={cn("flex flex-col items-center gap-2.5", className)}>
        {/* Identité & GitHub en mode replié */}
        <Tooltip>
          <TooltipTrigger asChild>
            <a
              href={GITHUB_REPO_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center w-10 h-10 rounded-md text-zinc-500 hover:text-zinc-200 hover:bg-white/[0.04] transition-colors"
              aria-label={t("nav.github")}
            >
              <Github className="w-4 h-4" />
            </a>
          </TooltipTrigger>
          <TooltipContent side="right" sideOffset={10}>
            {t("app.name")} {t("app.version")} • {t("nav.github")}
          </TooltipContent>
        </Tooltip>

        {/* Préférences : Langue & Paramètres */}
        <LanguageSwitcher compact />

        <Tooltip>
          <TooltipTrigger asChild>
            <span className="inline-flex cursor-not-allowed">
              <button
                type="button"
                disabled
                className="flex items-center justify-center w-10 h-10 rounded-md text-zinc-600 opacity-40 pointer-events-none transition-colors"
                aria-label={ariaLabel}
              >
                <Settings className="w-4 h-4" />
              </button>
            </span>
          </TooltipTrigger>
          <TooltipContent side="right" sideOffset={10}>
            {comingSoonText}
          </TooltipContent>
        </Tooltip>
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col gap-2 px-1", className)}>
      {/* 1. AU-DESSUS : Identité SYNK v1.0.0-beta et lien GitHub */}
      <div className="flex items-center justify-between text-[11px] font-mono text-zinc-500 pb-2 border-b border-white/[0.04]">
        <div className="flex items-center gap-1.5 text-zinc-400">
          <SynkIcon size={12} className="opacity-70" />
          <span className="tracking-tight">{t("app.name")} {t("app.version")}</span>
        </div>
        <a
          href={GITHUB_REPO_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 text-zinc-500 hover:text-zinc-200 transition-colors"
        >
          <span>{t("nav.github")}</span>
          <ExternalLink className="w-2.5 h-2.5" />
        </a>
      </div>

      {/* 2. EN-DESSOUS : Préférences utilisateur (Langue + Réglages) */}
      <div className="flex items-center justify-between pt-0.5">
        <LanguageSwitcher showGlobe />
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="inline-flex cursor-not-allowed">
              <button
                type="button"
                disabled
                className="p-1.5 rounded-md text-zinc-600 opacity-40 pointer-events-none transition-colors"
                aria-label={ariaLabel}
              >
                <Settings className="w-3.5 h-3.5" />
              </button>
            </span>
          </TooltipTrigger>
          <TooltipContent side="top">
            {comingSoonText}
          </TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
}

export default SidebarSettings;
