import { Settings } from "lucide-react";
import { useTranslation } from "react-i18next";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export interface SidebarSettingsProps {
  isCollapsed?: boolean;
  className?: string;
}

/**
 * Pied de page de navigation pour les réglages globaux (langue, préférences).
 * - Ultra-discret avec boutons ghost (zéro bouton plein)
 * - Supporte le mode complet (horizontal) et le mode compact (vertical centré)
 */
export function SidebarSettings({ isCollapsed = false, className }: SidebarSettingsProps) {
  const { t } = useTranslation("global");
  const settingsTooltip = `${t("nav.settings")} (${t("platforms.comingSoon")})`;

  if (isCollapsed) {
    return (
      <div className={cn("flex flex-col items-center gap-2", className)}>
        <LanguageSwitcher compact />
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              disabled
              className="flex items-center justify-center w-10 h-10 rounded-md text-zinc-600 opacity-40 cursor-not-allowed transition-colors"
              aria-label={settingsTooltip}
            >
              <Settings className="w-4 h-4" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="right" sideOffset={10}>
            {settingsTooltip}
          </TooltipContent>
        </Tooltip>
      </div>
    );
  }

  return (
    <div className={cn("flex items-center justify-between px-1", className)}>
      <LanguageSwitcher showGlobe />
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            disabled
            className="p-1.5 rounded-md text-zinc-600 opacity-40 cursor-not-allowed transition-colors"
            aria-label={settingsTooltip}
          >
            <Settings className="w-3.5 h-3.5" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="top">
          {settingsTooltip}
        </TooltipContent>
      </Tooltip>
    </div>
  );
}

export default SidebarSettings;
