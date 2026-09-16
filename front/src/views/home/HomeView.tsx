import { Omnibox, PlatformBadges } from "@/components/shared";
import { Heading } from "./components/Heading";
import { ModeToggle } from "./components/ModeToggle";
import { useHome } from "@/hooks/useHome";

/**
 * Vue d'accueil principale :
 * Orchestre la présentation sans implémenter de logique interne.
 */
export function HomeView() {
  const home = useHome();

  return (
    <div className="relative flex-1 flex flex-col items-center justify-center w-full max-w-full px-4 sm:px-6 md:px-12 py-10 animate-fade-in">
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
