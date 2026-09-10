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
import { RoomSessionInfo, type RoomSessionInfoProps } from "./RoomSessionInfo";

export function RoomMobileInfoSheet(props: RoomSessionInfoProps) {
  const [open, setOpen] = useState(false);
  const { t } = useTranslation("room");

  return (
    <div className="xl:hidden w-full max-w-4xl flex items-center justify-end mb-2.5">
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <button
            type="button"
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#141417]/90 border border-white/10 text-xs font-mono hover:bg-[#27272a] hover:border-white/20 transition-all cursor-pointer shadow-sm"
            aria-label={t("sidebar.info")}
          >
            <div
              className={`w-1.5 h-1.5 rounded-full ${
                props.isConnected
                  ? "bg-[#0ac8b9] shadow-[0_0_6px_#0ac8b9] animate-pulse"
                  : "bg-zinc-600"
              }`}
            />
            <span className="text-[#0ac8b9] font-bold">#{props.roomId}</span>
            <span className="text-zinc-600">|</span>
            <span className="text-zinc-300 flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-zinc-400" />
              <span>{props.participants.length}</span>
            </span>
          </button>
        </SheetTrigger>
        <SheetContent side="right" className="w-80 p-6 overflow-y-auto">
          <SheetHeader className="mb-4">
            <SheetTitle>{t("sidebar.info")}</SheetTitle>
          </SheetHeader>
          <RoomSessionInfo {...props} />
        </SheetContent>
      </Sheet>
    </div>
  );
}
