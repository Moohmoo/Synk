import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-none text-xs font-sans font-semibold uppercase tracking-wider transition-all duration-150 ease-out disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 outline-none select-none cursor-pointer",
  {
    variants: {
      variant: {
        primary:
          "bg-[#ff4655] hover:bg-[#ff4655]/90 text-white font-bold border border-transparent shadow-[0_0_16px_rgba(255,70,85,0.3)] hover:shadow-[0_0_24px_rgba(255,70,85,0.5)] active:translate-y-[1px]",
        teal:
          "bg-[#0ac8b9]/15 hover:bg-[#0ac8b9]/25 text-[#0ac8b9] border border-[#0ac8b9]/30 hover:border-[#0ac8b9]/50 active:translate-y-[1px]",
        secondary:
          "bg-white/[0.04] hover:bg-white/[0.08] text-zinc-300 border border-white/5 hover:border-white/10 active:translate-y-[1px]",
        outline:
          "border border-white/10 bg-transparent text-zinc-300 hover:bg-white/[0.04] hover:border-white/20 active:translate-y-[1px]",
        ghost:
          "text-zinc-400 hover:text-zinc-100 hover:bg-white/[0.04] active:translate-y-[1px]",
        destructive:
          "bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 border border-rose-800/80 active:translate-y-[1px]",
      },
      size: {
        default: "h-10 px-5 py-2",
        sm: "h-8 px-3 text-[11px]",
        lg: "h-12 px-7 text-sm",
        icon: "size-10",
      },
    },
    defaultVariants: {
      variant: "secondary",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
