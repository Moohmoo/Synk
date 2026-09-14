import { Link, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Home, PanelLeftClose, PanelLeft } from "lucide-react";
import { Logo } from "@/components/Logo";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useUIStore } from "@/stores/uiStore";
import { cn } from "@/lib/utils";

export interface LeftSidebarProps {
  className?: string;
}

export interface LeftNavContentProps {
  onItemClick?: () => void;
  className?: string;
}

/**
 * Contenu réutilisable des liens de navigation principale.
 * Utilisé dans la LeftSidebar desktop et dans le Sheet mobile.
 */
export function LeftNavContent({ onItemClick, className }: LeftNavContentProps = {}) {
  const location = useLocation();
  const { t } = useTranslation("global");
  const isHome = location.pathname === "/";

  return (
    <nav className={cn("flex flex-col px-2.5", className)}>
      <Link
        to="/"
        onClick={onItemClick}
        className={cn(
          "flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-md transition-colors duration-150",
          isHome
            ? "bg-white/[0.08] text-zinc-100"
            : "text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.04]"
        )}
      >
        <Home className={cn("w-4 h-4 transition-colors", isHome ? "text-zinc-100" : "text-zinc-400")} />
        <span>{t("nav.home")}</span>
      </Link>
    </nav>
  );
}

/**
 * Barre latérale gauche (Le Socle) de la navigation.
 * - Repliable via useUIStore avec icône de panneau.
 * - Logo masqué en mode compact (replié), uniquement le bouton toggle au centre.
 * - Hauteur de header (h-14) alignée sur le Main Canvas grâce à mt-4.
 * - Icône d'accueil universelle (Home) et contraste net de l'item actif en mode replié.
 */
export function LeftSidebar({ className }: LeftSidebarProps = {}) {
  const location = useLocation();
  const { t } = useTranslation("global");
  const isHome = location.pathname === "/";

  const isSidebarCollapsed = useUIStore((state) => state.isSidebarCollapsed);
  const toggleSidebar = useUIStore((state) => state.toggleSidebar);

  return (
    <aside
      className={cn(
        "flex-shrink-0 flex flex-col relative z-10 bg-zinc-950 select-none mt-4 transition-all duration-300 ease-in-out",
        isSidebarCollapsed ? "w-[64px]" : "w-[240px]",
        className
      )}
    >
      {/* Conteneur Header Logo + Bouton Toggle (Hauteur h-14 strictement alignée avec le Canvas) */}
      <div
        className={cn(
          "h-14 flex items-center shrink-0 mb-3 transition-all",
          isSidebarCollapsed ? "justify-center" : "px-4 justify-between"
        )}
      >
        {!isSidebarCollapsed && <Logo showText={true} />}

        {/* Bouton Toggle Sidebar (Réduire / Déplier) */}
        <button
          type="button"
          onClick={toggleSidebar}
          className="p-1.5 rounded-md text-zinc-400 hover:text-white hover:bg-zinc-900 transition-colors cursor-pointer"
          title={isSidebarCollapsed ? "Déplier la barre latérale" : "Réduire la barre latérale"}
          aria-label={isSidebarCollapsed ? "Déplier la barre latérale" : "Réduire la barre latérale"}
        >
          {isSidebarCollapsed ? (
            <PanelLeft className="w-4 h-4 text-zinc-400 hover:text-zinc-200" />
          ) : (
            <PanelLeftClose className="w-4 h-4 text-zinc-400 hover:text-zinc-200" />
          )}
        </button>
      </div>

      {/* Menu de navigation avec paddings internes harmonisés */}
      {isSidebarCollapsed ? (
        <nav className="flex flex-col px-2.5">
          <Tooltip>
            <TooltipTrigger asChild>
              <Link
                to="/"
                className={cn(
                  "flex items-center justify-center w-10 h-10 mx-auto rounded-md transition-colors duration-150",
                  isHome
                    ? "bg-white/[0.08] text-zinc-100"
                    : "text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.04]"
                )}
              >
                <Home className={cn("w-4 h-4 transition-colors", isHome ? "text-zinc-100" : "text-zinc-400")} />
              </Link>
            </TooltipTrigger>
            <TooltipContent side="right" sideOffset={10}>
              {t("nav.home")}
            </TooltipContent>
          </Tooltip>
        </nav>
      ) : (
        <LeftNavContent />
      )}
    </aside>
  );
}

export default LeftSidebar;



