import { useTranslation } from "react-i18next";
import { Tv } from "lucide-react";
import { Omnibox } from "@/components/shared";

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
      <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-zinc-900/80 border border-white/10 flex items-center justify-center mb-2 sm:mb-4 shadow-inner">
        <Tv className="w-5 h-5 sm:w-6 sm:h-6 text-[#0ac8b9]" />
      </div>
      <h2 className="text-sm sm:text-base font-sans font-bold tracking-tight text-zinc-200 mb-1">
        {t("player.waitingTitle")}
      </h2>
      <p className="text-xs font-sans text-zinc-400 mb-4 sm:mb-6 text-center max-w-sm">
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

      <div className="flex flex-wrap items-center justify-center gap-1.5 sm:gap-2 mt-3 sm:mt-5 text-[10px] font-mono text-zinc-400 uppercase tracking-wider">
        <span className="px-2.5 py-0.5 rounded-md bg-[#121215] border border-white/5">YouTube</span>
        <span className="px-2.5 py-0.5 rounded-md bg-[#121215] border border-white/5">Twitch</span>
        <span className="px-2.5 py-0.5 rounded-md bg-[#121215] border border-white/5">Vimeo</span>
        <span className="px-2.5 py-0.5 rounded-md bg-[#121215] border border-white/5">Direct / HLS</span>
      </div>
    </div>
  );
}
