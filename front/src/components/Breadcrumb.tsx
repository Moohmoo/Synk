import { Link, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";

export interface BreadcrumbItem {
  labelKey: string;
  path?: string;
  defaultLabel?: string;
}

export interface BreadcrumbProps {
  className?: string;
}

/**
 * Configuration des routes et de leur arborescence parente.
 */
const ROUTE_CONFIG: Record<string, { labelKey: string; parent?: BreadcrumbItem }> = {
  "/": { labelKey: "nav.home" },
  "/room": { labelKey: "nav.room", parent: { labelKey: "nav.home", path: "/" } },
};

/**
 * Composant Fil d'Ariane (Breadcrumb) dans la Top Navbar.
 * Sans le mot redondant "SYNK", avec traduction i18n.
 */
export function Breadcrumb({ className }: BreadcrumbProps) {
  const { pathname } = useLocation();
  const { t } = useTranslation("global");

  // Détermination de la configuration correspondant à la route actuelle
  const isRoom = pathname.startsWith("/room/");
  const configKey = isRoom ? "/room" : ROUTE_CONFIG[pathname] ? pathname : "/";
  const config = ROUTE_CONFIG[configKey] || { labelKey: "nav.home" };

  const items: BreadcrumbItem[] = [];

  // Niveau parent (ex: Accueil lors de la navigation dans un salon)
  if (config.parent) {
    items.push(config.parent);
  }

  // Niveau actif (page actuelle)
  items.push({ labelKey: config.labelKey });

  return (
    <nav aria-label="Fil d'ariane" className={cn("flex items-center font-mono text-xs select-none", className)}>
      {items.map((item, index) => {
        const isLast = index === items.length - 1;
        const translatedLabel = t(item.labelKey, item.defaultLabel || item.labelKey);

        return (
          <div key={`${item.labelKey}-${index}`} className="flex items-center">
            {index > 0 && (
              <span className="mx-2 text-zinc-700" aria-hidden="true">
                /
              </span>
            )}
            {isLast || !item.path ? (
              <span className="text-zinc-300 font-medium">
                {translatedLabel}
              </span>
            ) : (
              <Link
                to={item.path}
                className="text-zinc-500 hover:text-zinc-300 cursor-pointer transition-colors"
              >
                {translatedLabel}
              </Link>
            )}
          </div>
        );
      })}
    </nav>
  );
}

export default Breadcrumb;
