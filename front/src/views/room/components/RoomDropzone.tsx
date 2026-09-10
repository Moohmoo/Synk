import { useTranslation } from "react-i18next";
import { Tv } from "lucide-react";
import { Omnibox, PlatformBadges } from "@/components/shared";

interface RoomDropzoneProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  disabled?: boolean;
}

export function RoomDropzone({ value, onChange, onSubmit, disabled }: RoomDropzoneProps) {
  const { t } = useTranslation(["room", "global"]);

  return (
    <div className="flex flex-col items-center w-full max-w-xl px-3 sm:px-4 select-none">
      <div className="mb-2 sm:mb-3 flex items-center justify-center">
        <Tv className="w-8 h-8 sm:w-9 sm:h-9 text-[#0ac8b9] drop-shadow-[0_0_12px_rgba(10,200,185,0.4)]" />
      </div>
      <h2 className="text-sm sm:text-base font-bold tracking-tight text-white mb-1">
        {t("player.waitingTitle")}
      </h2>
      <p className="text-xs text-zinc-400 mb-4 sm:mb-5 text-center max-w-sm leading-relaxed">
        {t("player.waitingSubtitle")}
      </p>

      <Omnibox
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onSubmit={onSubmit}
        mode="join"
        placeholder={t("header.urlPlaceholder")}
        buttonText={t("header.load")}
        disabled={disabled}
        maxLength={2048}
        className="w-full relative z-20 shadow-2xl"
        autoFocus
      />

      <PlatformBadges className="mt-3 sm:mt-5" />
    </div>
  );
}
