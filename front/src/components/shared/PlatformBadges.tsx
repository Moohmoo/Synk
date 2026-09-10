import React from "react";
import { Youtube, Twitch, Radio } from "lucide-react";

interface PlatformItem {
  name: string;
  icon: React.ComponentType<{ className?: string }>;
  hoverIcon: string;
}

function VimeoIcon({ className = "w-3 h-3" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M23.977 6.416c-.105 2.338-1.739 5.543-4.894 9.609-3.268 4.247-6.026 6.37-8.29 6.37-1.409 0-2.578-1.294-3.553-3.881L5.322 11.4C4.603 8.816 3.834 7.522 3.01 7.522c-.179 0-.806.378-1.881 1.132L0 7.197c1.185-1.044 2.498-2.084 3.94-3.123 1.99-1.718 3.447-2.617 4.37-2.697 2.193-.203 3.541 1.307 4.043 4.532.535 3.442.9 5.58 1.096 6.416.586 2.75 1.22 4.128 1.899 4.128.528 0 1.282-.806 2.261-2.42 1-1.611 1.543-2.83 1.627-3.654.148-1.391-.397-2.087-1.637-2.087-.585 0-1.22.133-1.905.398 1.218-3.985 3.535-5.918 6.953-5.797 2.535.088 3.73 1.705 3.58 4.851z" />
    </svg>
  );
}

const PLATFORMS: PlatformItem[] = [
  {
    name: "YouTube",
    icon: Youtube,
    hoverIcon: "group-hover:text-[#ff0000]",
  },
  {
    name: "Twitch",
    icon: Twitch,
    hoverIcon: "group-hover:text-[#a970ff]",
  },
  {
    name: "Vimeo",
    icon: VimeoIcon,
    hoverIcon: "group-hover:text-[#1ab7ea]",
  },
  {
    name: "Direct (HLS)",
    icon: Radio,
    hoverIcon: "group-hover:text-[#0ac8b9]",
  },
];

export interface PlatformBadgesProps {
  className?: string;
  maxVisible?: number;
}

/**
 * Ligne canonique des plateformes de streaming supportées.
 * Conçue pour révéler la couleur de chaque marque subtilement au survol (micro-interaction).
 */
export function PlatformBadges({ className = "", maxVisible = 4 }: PlatformBadgesProps) {
  const visiblePlatforms = PLATFORMS.slice(0, maxVisible);
  const remainingCount = PLATFORMS.length - maxVisible;

  return (
    <div
      className={`flex flex-wrap items-center justify-center gap-x-3.5 gap-y-1.5 text-xs font-sans select-none ${className}`}
    >
      {visiblePlatforms.map(({ name, icon: Icon, hoverIcon }, index) => (
        <React.Fragment key={name}>
          {index > 0 && (
            <span className="text-zinc-700/60 select-none text-xs" aria-hidden="true">
              /
            </span>
          )}
          <span className="group inline-flex items-center gap-1.5 py-0.5 text-zinc-400 hover:text-zinc-200 transition-colors duration-200 cursor-default">
            <Icon className={`w-3.5 h-3.5 text-zinc-500 transition-colors duration-200 ${hoverIcon} shrink-0`} />
            <span className="text-xs font-medium tracking-normal">{name}</span>
          </span>
        </React.Fragment>
      ))}

      {remainingCount > 0 && (
        <>
          <span className="text-zinc-700/60 select-none text-xs" aria-hidden="true">
            /
          </span>
          <span className="text-zinc-500 text-xs font-medium">+{remainingCount}</span>
        </>
      )}
    </div>
  );
}

export default PlatformBadges;
