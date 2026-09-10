import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";

export interface LogoProps {
  className?: string;
  onClick?: () => void;
}

export function Logo({ className, onClick }: LogoProps = {}) {
  return (
    <Link
      to="/"
      onClick={onClick}
      className={cn(
        "group inline-flex items-center gap-2 w-fit shrink-0 cursor-pointer transition-colors duration-200",
        className
      )}
    >
      <svg 
        width="24" 
        height="24" 
        viewBox="0 0 24 24" 
        fill="currentColor" 
        xmlns="http://www.w3.org/2000/svg"
        className="text-white group-hover:text-[#0ac8b9] transition-colors duration-200 shrink-0"
      >
        {/* Anneau extérieur (Hexagone) */}
        <path d="M12 1.5l9 5.2v10.6l-9 5.2l-9-5.2V6.7l9-5.2zm0 2.5L4.5 8.3v7.4l7.5 4.3l7.5-4.3V8.3L12 4z" />
        
        {/* Cœur massif avec découpe "Double Play" en espace négatif (fillRule="evenodd") */}
        <path 
          fillRule="evenodd" 
          clipRule="evenodd" 
          d="M12 6 L17.5 9.2 V14.8 L12 18 L6.5 14.8 V9.2 Z M8.5 9.5 V14.5 L12 12 Z M 12.5 9.5 V14.5 L16 12 Z" 
        />
      </svg>

      <span className="text-base font-extrabold tracking-widest text-white group-hover:text-[#0ac8b9] transition-colors duration-200">
        SYNK
      </span>
    </Link>
  );
}

export default Logo;
