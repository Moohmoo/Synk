import { cn } from "@/lib/utils";

export interface SynkIconProps {
  className?: string;
  glow?: boolean;
  size?: number | string;
}

/**
 * Icône SVG du logo Synk avec effet de lueur optionnel.
 */
export function SynkIcon({
  className,
  glow = false,
  size = 24,
}: SynkIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("shrink-0", className)}
      aria-hidden="true"
    >
      {/* Coins extérieurs */}
      <g fill="#0ac8b9" className="transition-opacity duration-200">
        <path d="M2 13V6L6 2H13V6H6V13H2Z" />
        <path d="M19 2H26L30 6V13H26V6H19V2Z" />
        <path d="M30 19V26L26 30H19V26H26V19H30Z" />
        <path d="M13 30H6L2 26V19H6V26H13V30Z" />
      </g>

      {/* Double chevron central */}
      <g
        className={cn(
          "fill-white transition-all duration-300",
          glow && "drop-shadow-[0_0_8px_rgba(10,200,185,0.6)]"
        )}
      >
        <path d="M8.5 10L14.5 16L8.5 22H12L18 16L12 10H8.5Z" />
        <path d="M15 10L21 16L15 22H18.5L24.5 16L18.5 10H15Z" />
      </g>
    </svg>
  );
}

export default SynkIcon;
