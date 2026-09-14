import { Link } from "react-router-dom";
import { LogoSynk } from "@/components/LogoSynk";
import { cn } from "@/lib/utils";

export interface LogoProps {
  className?: string;
  onClick?: () => void;
  showText?: boolean;
}

export function Logo({ className, onClick, showText = true }: LogoProps = {}) {
  return (
    <Link
      to="/"
      onClick={onClick}
      className={cn(
        "group inline-flex items-center gap-3 w-fit shrink-0 cursor-pointer transition-colors duration-200",
        className
      )}
    >
      <LogoSynk
        size={30}
        className="group-hover:drop-shadow-[0_0_8px_rgba(10,200,185,0.45)] transition-all duration-200"
      />

      {showText && (
        <span className="text-base font-bold tracking-widest text-zinc-100 group-hover:text-white transition-colors duration-200 font-mono">
          SYNK
        </span>
      )}
    </Link>
  );
}

export default Logo;
