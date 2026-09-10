import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 px-2 py-0.5 text-[11px] font-sans uppercase tracking-wider border rounded-md select-none transition-colors",
  {
    variants: {
      variant: {
        default: "border-white/5 bg-white/[0.04] text-zinc-300",
        live: "border-[#ff4655]/40 bg-[#ff4655]/15 text-[#ff4655] font-bold shadow-[0_0_8px_rgba(255,70,85,0.3)]",
        host: "border-[#0ac8b9]/40 bg-[#0ac8b9]/15 text-[#0ac8b9] font-bold",
        warning: "border-amber-500/30 bg-amber-500/10 text-amber-400",
        destructive: "border-[#ff4655]/30 bg-[#ff4655]/10 text-[#ff4655]",
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
