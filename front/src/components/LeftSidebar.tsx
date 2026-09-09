import { Link, useLocation } from "react-router-dom";
import { LayoutDashboard, Clock, Settings } from "lucide-react";
import { useTranslation } from "react-i18next";

import { cn } from "@/lib/utils";

export interface LeftSidebarProps {
  className?: string;
}

/**
 * Barre latérale gauche de navigation principale.
 * Affiche les onglets de navigation globale (Accueil, Récents, Paramètres).
 */
export function LeftSidebar({ className }: LeftSidebarProps = {}) {
  const location = useLocation();
  const { t } = useTranslation("global");

  const navItems = [
    {
      label: t("nav.home"),
      path: "/",
      icon: LayoutDashboard,
      isActive: location.pathname === "/",
    },
    {
      label: t("nav.recent"),
      path: "#recent",
      icon: Clock,
      isActive: false,
    },
    {
      label: t("nav.settings"),
      path: "#settings",
      icon: Settings,
      isActive: false,
    },
  ];

  return (
    <aside className={cn("hidden md:flex w-60 flex-col bg-transparent p-4 shrink-0 select-none h-full relative z-20", className)}>
      {/* Section Header */}
      <div className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500 mb-3 px-3">
        {t("nav.section")}
      </div>

      {/* Navigation List */}
      <nav className="flex-1 space-y-1.5 mt-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`group flex items-center gap-3 px-3.5 py-2.5 text-sm font-medium tracking-wide border-l-[3px] transition-all duration-200 ${
                item.isActive
                  ? "text-white bg-gradient-to-r from-[#0ac8b9]/20 to-transparent border-[#0ac8b9]"
                  : "border-transparent text-zinc-400 hover:text-white hover:bg-gradient-to-r hover:from-[#0ac8b9]/15 hover:to-transparent hover:border-[#0ac8b9]"
              }`}
            >
              <Icon
                className={`w-4 h-4 shrink-0 transition-colors duration-200 ${
                  item.isActive
                    ? "text-[#0ac8b9]"
                    : "text-zinc-500 group-hover:text-[#0ac8b9]"
                }`}
              />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}

export default LeftSidebar;
