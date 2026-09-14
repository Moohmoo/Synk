import { Omnibox, PlatformBadges } from "@/components/shared";
import { Heading } from "./components/Heading";
import { ModeToggle } from "./components/ModeToggle";
import { useHome } from "@/hooks/useHome";

/**
 * Vue d'accueil principale :
 * Composant de mise en page sobre déléguant l'affichage à Heading/ModeToggle
 * et l'orchestration du flux à useHome.
 */
export function HomeView() {
  const {
    mode,
    switchMode,
    inputRef,
    inputValue,
    setInputValue,
    handleKeyDown,
    handleSubmit,
    isLoading,
    placeholder,
    buttonText,
    badge,
  } = useHome();

  return (
    <div className="relative flex-1 flex flex-col items-center justify-center w-full max-w-full px-4 sm:px-6 md:px-12 py-10 animate-fade-in">
      {/* 
        POURQUOI px-4 sm:px-6 md:px-12 : Libère 16px d'espace horizontal sur smartphone 
        pour loger confortablement le badge et l'omnibox sans débordement.
      */}
      {/* Conteneur principal (rehaussé au centre optique du halo) */}
      <div className="relative z-10 flex flex-col items-center w-full -translate-y-8 sm:-translate-y-12">
        {/* Titre & Sous-titre en superposition de grille (zéro layout shift) */}
        <Heading mode={mode} />

        {/* Le sélecteur de mode (Créer / Rejoindre) */}
        <ModeToggle mode={mode} onChange={switchMode} />

        {/* L'Omnibox d'accueil */}
        <Omnibox
          ref={inputRef}
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          mode={mode}
          placeholder={placeholder}
          buttonText={buttonText}
          badge={badge}
          onSubmit={handleSubmit}
          isLoading={isLoading}
          autoFocus
        />

        {/* Badges discrets des plateformes supportées */}
        <PlatformBadges className="mt-5" />
      </div>
    </div>
  );
}

export default HomeView;
