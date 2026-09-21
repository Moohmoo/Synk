import { useTranslation } from "react-i18next";
import { Link2 } from "lucide-react";
import { Omnibox } from "@/components/shared";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

interface ChangeMediaDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  value: string;
  onChange: (value: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  disabled?: boolean;
}

export function ChangeMediaDialog({
  open,
  onOpenChange,
  value,
  onChange,
  onSubmit,
  disabled,
}: ChangeMediaDialogProps) {
  const { t } = useTranslation(["room", "global"]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100%-2rem)] sm:max-w-xl bg-[#141417]/95 border-white/10 border-l-[3px] border-l-primary backdrop-blur-xl p-4 sm:p-6 rounded-sm shadow-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-sm font-mono tracking-wider text-white">
            <Link2 className="w-4 h-4 text-primary" />
            <span>{t("header.changeMediaTitle")}</span>
          </DialogTitle>
          <DialogDescription className="text-xs text-zinc-400 font-sans">
            {t("header.changeMediaSubtitle")}
          </DialogDescription>
        </DialogHeader>

        <div className="mt-2">
          <Omnibox
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onSubmit={onSubmit}
            mode="join"
            placeholder={t("header.urlPlaceholder")}
            buttonText={t("header.load")}
            disabled={disabled}
            maxLength={2048}
            className="w-full relative z-20"
            autoFocus
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
