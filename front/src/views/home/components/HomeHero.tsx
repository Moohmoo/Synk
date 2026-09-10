import { useTranslation } from "react-i18next";

interface HomeHeroProps {
  mode: "create" | "join";
}

/**
 * En-tête dynamique de la page d'accueil :
 * Superpose les titres et sous-titres des modes Créer et Rejoindre
 * en grille CSS pour une transition fluide sans aucun saut de mise en page (layout shift).
 */
export function HomeHero({ mode }: HomeHeroProps) {
  const { t } = useTranslation("global");

  return (
    <div className="grid grid-cols-1 grid-rows-1 place-items-center mb-6 max-w-lg text-center select-none">
      {/* État Mode Créer */}
      <div
        className={`col-start-1 row-start-1 flex flex-col items-center transition-all duration-300 ease-out ${
          mode === "create"
            ? "opacity-100 scale-100"
            : "opacity-0 scale-95 pointer-events-none"
        }`}
      >
        <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight text-white">
          {t("home.createTitle")}
        </h1>
        <p className="text-xs sm:text-sm text-zinc-400 mt-2 max-w-md leading-relaxed">
          {t("home.createSubtitle")}
        </p>
      </div>

      {/* État Mode Rejoindre */}
      <div
        className={`col-start-1 row-start-1 flex flex-col items-center transition-all duration-300 ease-out ${
          mode === "join"
            ? "opacity-100 scale-100"
            : "opacity-0 scale-95 pointer-events-none"
        }`}
      >
        <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight text-white">
          {t("home.joinTitle")}
        </h1>
        <p className="text-xs sm:text-sm text-zinc-400 mt-2 max-w-md leading-relaxed">
          {t("home.joinSubtitle")}
        </p>
      </div>
    </div>
  );
}
