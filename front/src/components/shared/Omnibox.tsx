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
      <div className={cn("w-full max-w-xl flex flex-col items-center", className)}>
        <form
          onSubmit={onSubmit}
          className="w-full bg-[#141417] border border-white/10 rounded-xl p-1.5 flex items-center shadow-xl transition-all"
        >
          {badge && (
            <div className="flex items-center gap-1.5 bg-[#27272a] text-[#0ac8b9] border border-[#0ac8b9]/25 px-2.5 py-1 rounded-lg text-xs font-mono font-semibold shrink-0 ml-1">
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
            className="flex-1 min-w-[100px] w-full bg-transparent border-none outline-none px-3 text-sm font-medium text-zinc-100 placeholder-zinc-600"
            autoFocus={autoFocus}
            maxLength={maxLength}
            disabled={isLoading || disabled}
          />
          <button
            type="submit"
            disabled={isLoading || disabled}
            className={`w-[130px] flex-shrink-0 flex items-center justify-center py-1.5 rounded-lg text-xs font-semibold tracking-wide transition-all duration-300 ease-in-out ${
              isCreate
                ? "bg-[#ff4655] text-white hover:bg-[#ff4655]/90"
                : "bg-[#0ac8b9] text-[#09090b] hover:bg-[#0ac8b9]/90"
            } ${isLoading || disabled ? "opacity-70 cursor-not-allowed" : ""}`}
          >
            {displayButtonText}
          </button>
        </form>
      </div>
    );
  }
);

Omnibox.displayName = "Omnibox";
export default Omnibox;
