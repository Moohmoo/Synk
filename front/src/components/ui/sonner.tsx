import { Toaster as Sonner, toast } from "sonner";
import {
  CheckCircle2,
  AlertCircle,
  Info,
  AlertTriangle,
} from "lucide-react";
import React from "react";

type ToasterProps = React.ComponentProps<typeof Sonner>;

export const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      theme="dark"
      className="toaster group"
      position="bottom-center"
      duration={4000}
      offset={28}
      visibleToasts={3}
      richColors={false}
      style={{
        zIndex: 99999,
      }}
      icons={{
        success: <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />,
        error: <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />,
        info: <Info className="w-4 h-4 text-cyan-400 shrink-0" />,
        warning: <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />,
      }}
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-[#18181b]/95 group-[.toaster]:backdrop-blur-md group-[.toaster]:text-zinc-100 group-[.toaster]:border group-[.toaster]:border-white/10 group-[.toaster]:shadow-2xl group-[.toaster]:shadow-black/70 group-[.toaster]:rounded-sm group-[.toaster]:text-xs group-[.toaster]:font-medium py-3 px-4 flex items-center gap-3",
          title: "text-zinc-100 font-medium text-xs",
          description: "text-zinc-400 text-[11px] mt-0.5",
          actionButton:
            "group-[.toast]:bg-[#0ac8b9] group-[.toast]:text-zinc-950 group-[.toast]:font-semibold group-[.toast]:rounded-sm px-2.5 py-1 text-xs hover:group-[.toast]:bg-[#0ac8b9]/90 transition-colors",
          cancelButton:
            "group-[.toast]:bg-zinc-800 group-[.toast]:text-zinc-300 group-[.toast]:rounded-sm px-2.5 py-1 text-xs hover:group-[.toast]:bg-zinc-700 transition-colors",
        },
      }}
      {...props}
    />
  );
};

export { toast };
