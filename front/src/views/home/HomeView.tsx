import { Omnibox, PlatformBadges } from "@/components/shared";
import { Heading } from "./components/Heading";
import { ModeToggle } from "./components/ModeToggle";
import { ActiveSessionPill } from "./components/ActiveSessionPill";
import { useHome } from "@/hooks/useHome";

/**
 * Vue d'accueil principale :
 * Orchestre la présentation sans implémenter de logique interne.
 */
export function HomeView() {
  const home = useHome();

  return (
    <div className="relative flex-1 flex flex-col items-center justify-center w-full max-w-full px-4 sm:px-6 md:px-12 py-10 animate-fade-in overflow-hidden">
      {/* Halo lumineux d'ambiance (Radial Glow Cyan) centré derrière le formulaire */}
      <div
        className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[520px] sm:w-[680px] h-[360px] sm:h-[440px] rounded-full bg-primary/[0.07] blur-[120px] sm:blur-[140px] select-none"
        aria-hidden="true"
      />

      {/* Pill discrète de reprise de salon en cours (si session active) */}
      <ActiveSessionPill />

      {/* Formulaire central */}
      <div className="relative z-10 flex flex-col items-center w-full -translate-y-8 sm:-translate-y-12">
        <Heading mode={home.mode} />
        <ModeToggle mode={home.mode} onChange={home.switchMode} />
        <Omnibox
          ref={home.inputRef}
          value={home.inputValue}
          onChange={(e) => home.setInputValue(e.target.value)}
          onKeyDown={home.handleKeyDown}
          mode={home.mode}
          placeholder={home.placeholder}
          buttonText={home.buttonText}
          badge={home.badge}
          onSubmit={home.handleSubmit}
          isLoading={home.isLoading}
          autoFocus
        />
        <PlatformBadges className="mt-5" />
      </div>
    </div>
  );
}

export default HomeView;
