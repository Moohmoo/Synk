import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Users } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { SidePanel, type SidePanelProps } from "./SidePanel";

export type DrawerProps = SidePanelProps;

/**
 * Tiroir coulissant pour appareils mobiles et tablettes (< xl),
 * donnant accès au panneau latéral (chat et membres) lorsque la barre latérale droite est masquée.
 */
export function Drawer(props: DrawerProps) {
  const [open, setOpen] = useState(false);
  const { t } = useTranslation("room");

  return (
    <div className="xl:hidden flex items-center">
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <button
            type="button"
            className="flex items-center gap-2 px-2.5 py-1 rounded bg-zinc-900 border border-zinc-800 text-xs font-mono hover:bg-zinc-800 hover:text-zinc-200 transition-colors cursor-pointer"
            aria-label={t("sidebar.info")}
          >
            <div
              className={`w-1.5 h-1.5 rounded-full ${
                props.isConnected
                  ? "bg-emerald-400 animate-pulse"
                  : "bg-zinc-600"
              }`}
            />
            <span className="text-zinc-200 font-bold">#{props.roomId}</span>
            <span className="text-zinc-600">|</span>
            <span className="text-zinc-300 flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-zinc-400" />
              <span>{props.participants.length}</span>
            </span>
          </button>
        </SheetTrigger>
        <SheetContent side="right" className="w-80 p-4 bg-zinc-950 border-l border-white/10 flex flex-col h-full overflow-hidden">
          <SheetHeader className="mb-2 text-left">
            <SheetTitle className="text-sm font-mono font-bold tracking-wider uppercase text-zinc-100">
              {t("sidebar.info")}
            </SheetTitle>
          </SheetHeader>
          <div className="flex-1 min-h-0">
            <SidePanel {...props} />
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

export default Drawer;
