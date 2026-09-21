import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 px-2 py-0.5 text-[11px] font-sans uppercase tracking-wider border rounded-sm select-none transition-colors",
  {
    variants: {
      variant: {
        default: "border-white/5 bg-white/[0.04] text-zinc-300",
        live: "border-rose-500/40 bg-rose-500/15 text-rose-400 font-bold shadow-[0_0_8px_rgba(244,63,94,0.3)]",
        host: "border-zinc-800 bg-zinc-900 text-zinc-300 font-medium",
        warning: "border-amber-500/30 bg-amber-500/10 text-amber-400",
        destructive: "border-rose-500/30 bg-rose-500/10 text-rose-400",
        outline: "border-white/10 bg-transparent text-zinc-400",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
