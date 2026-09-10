import { ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";

export interface RightSidebarProps {
  children?: React.ReactNode;
  className?: string;
}

export function RightSidebar({ children, className }: RightSidebarProps) {
  return (
    <aside
      className={cn(
        "w-64 hidden xl:flex flex-col bg-transparent p-4 shrink-0 select-none h-full text-zinc-400 justify-between relative z-20",
        className
      )}
    >
      <div
        id="right-sidebar-slot"
        className="flex-1 overflow-y-auto flex flex-col min-h-0 pr-1"
      >
        {children}
      </div>

      {/* MODULE : PROJET / INFORMATIONS */}
      <footer className="pt-4 border-t border-white/10 flex items-center justify-between text-xs text-zinc-500 shrink-0">
        <span className="text-[11px] font-mono text-zinc-500 tracking-tight">Synk v1.0.0-beta</span>
        <a
          href="https://github.com"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
        >
          <span>GitHub</span>
          <ExternalLink className="w-3 h-3" />
        </a>
      </footer>
    </aside>
  );
}

export { RightSidebarSlot } from "./RightSidebarSlot";
export default RightSidebar;
