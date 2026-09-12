import React, { forwardRef } from "react";
import { X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";

export interface OmniboxBadge {
  text: string;
  onRemove?: () => void;
}

export interface OmniboxProps {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onSubmit: (e: React.FormEvent) => void;
  mode?: "create" | "join";
  placeholder?: string;
  buttonText?: string;
  isLoading?: boolean;
  disabled?: boolean;
  autoFocus?: boolean;
  maxLength?: number;
  className?: string;
  badge?: OmniboxBadge | null;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
}

export const Omnibox = forwardRef<HTMLInputElement, OmniboxProps>(
  (
    {
      value,
      onChange,
      onSubmit,
      mode = "join",
      placeholder,
      buttonText,
      isLoading = false,
      disabled = false,
      autoFocus = false,
      maxLength = 2048,
      className = "",
      badge,
      onKeyDown,
    },
    ref
  ) => {
    const { t } = useTranslation("global");
    const isCreate = mode === "create";

    const defaultPlaceholder = isCreate
      ? t("home.createPlaceholder")
      : t("home.joinCodePlaceholder");

    const defaultButtonText = isLoading
      ? isCreate
        ? "CRÉATION..."
        : t("home.connecting")
      : isCreate
      ? t("home.create")
      : t("home.join");

    const displayButtonText = buttonText || defaultButtonText;

    return (
      <div className={cn("w-full max-w-lg flex flex-col items-center", className)}>
        <form
          onSubmit={onSubmit}
          className="w-full flex items-center bg-zinc-900/40 border border-white/10 rounded-lg p-1.5 shadow-2xl backdrop-blur-md focus-within:border-white/20 transition-all"
        >
          {badge && (
            <div className="flex items-center gap-1.5 bg-zinc-800/80 text-[#0ac8b9] border border-[#0ac8b9]/25 px-2.5 py-1 rounded-md text-xs font-mono font-semibold shrink-0 ml-1">
              <span>{badge.text}</span>
              {badge.onRemove && (
                <button
                  type="button"
                  onClick={badge.onRemove}
                  className="text-zinc-400 hover:text-white transition-colors p-0.5 rounded cursor-pointer"
                  title={t("home.changeRoom", "Changer de salon")}
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          )}

          <input
            ref={ref}
            type="text"
            value={value}
            onChange={onChange}
            onKeyDown={onKeyDown}
            placeholder={placeholder || defaultPlaceholder}
            className="flex-1 bg-transparent border-none text-sm text-zinc-200 px-3 outline-none font-mono placeholder:text-zinc-600 placeholder:font-sans"
            autoFocus={autoFocus}
            maxLength={maxLength}
            disabled={isLoading || disabled}
          />

          <button
            type="submit"
            disabled={isLoading || disabled}
            className={`px-6 py-1.5 bg-[#0ac8b9] text-[#09090b] text-xs font-bold rounded-md hover:bg-[#0ac8b9]/90 transition-all shadow-[0_0_15px_rgba(10,200,185,0.2)] flex-shrink-0 cursor-pointer ${
              isLoading || disabled ? "opacity-70 cursor-not-allowed" : "active:translate-y-[1px]"
            }`}
          >
            <span className="truncate">{displayButtonText}</span>
          </button>
        </form>
      </div>
    );
  }
);

Omnibox.displayName = "Omnibox";
export default Omnibox;
