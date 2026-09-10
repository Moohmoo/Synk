const PLATFORMS = ["YouTube", "Twitch", "Vimeo", "Direct / HLS"] as const;

export interface PlatformBadgesProps {
  className?: string;
}

/**
 * Badges canoniques des plateformes de streaming supportées.
 * Réutilisable sur la vue d'accueil et la dropzone d'attente d'un salon.
 */
export function PlatformBadges({ className = "" }: PlatformBadgesProps) {
  return (
    <div
      className={`flex flex-wrap items-center justify-center gap-1.5 sm:gap-2 text-[10px] font-mono text-zinc-400 uppercase tracking-wider select-none ${className}`}
    >
      {PLATFORMS.map((platform) => (
        <span
          key={platform}
          className="px-2.5 py-0.5 rounded-md bg-[#121215] border border-white/5"
        >
          {platform}
        </span>
      ))}
    </div>
  );
}

export default PlatformBadges;
