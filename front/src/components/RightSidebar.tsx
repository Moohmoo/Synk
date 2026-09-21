import { useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import { GITHUB_REPO_URL } from "@/lib/constants";

export interface RightSidebarProps {
  children?: React.ReactNode;
  className?: string;
}

export function RightSidebar({ children, className }: RightSidebarProps) {
  const location = useLocation();
  const { t } = useTranslation("global");
  const isRoom = location.pathname.startsWith("/room/");

  if (!isRoom) {
    return (
      <aside
        className={cn(
          "hidden sm:flex items-center gap-6 fixed bottom-4 right-8 z-20 select-none text-xs text-zinc-500",
          className
        )}
      >
        <div id="right-sidebar-slot" className="hidden" />
        <span className="text-[11px] font-mono text-zinc-500 tracking-tight">
          {t("app.name")} {t("app.version")}
        </span>
        <a
          href={GITHUB_REPO_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
        >
          <span>{t("nav.github")}</span>
          <ExternalLink className="w-3 h-3" />
        </a>
      </aside>
    );
  }

  return (
    <aside
      className={cn(
        "w-80 hidden xl:flex flex-col bg-zinc-900 border-l border-white/5 p-4 shrink-0 select-none h-full text-zinc-400 justify-between relative z-20",
        className
      )}
    >
      <div
        id="right-sidebar-slot"
        className="flex-1 flex flex-col min-h-0 pr-0.5"
      >
        {children}
      </div>

      {/* MODULE : PROJET / INFORMATIONS */}
      <footer className="pt-4 border-t border-white/5 flex items-center justify-between text-xs text-zinc-500 shrink-0">
        <span className="text-[11px] font-mono text-zinc-500 tracking-tight">
          {t("app.name")} {t("app.version")}
        </span>
        <a
          href={GITHUB_REPO_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
        >
          <span>{t("nav.github")}</span>
          <ExternalLink className="w-3 h-3" />
        </a>
      </footer>
    </aside>
  );
}

export { RightSidebarSlot } from "./RightSidebarSlot";
export default RightSidebar;
