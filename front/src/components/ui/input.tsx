import * as React from "react";
import { cn } from "@/lib/utils";

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: string;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, error, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-11 w-full rounded-sm bg-[#121215] px-3.5 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 border border-white/10 focus:border-primary focus:outline-none transition-colors disabled:cursor-not-allowed disabled:opacity-50",
          error && "border-rose-500 focus:border-rose-500",
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";

export { Input };
