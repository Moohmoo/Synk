import { useTranslation } from "react-i18next";

interface HomeModeToggleProps {
  mode: "create" | "join";
  onChange: (mode: "create" | "join") => void;
}

/**
 * Sélecteur de mode d'accueil (Créer / Rejoindre) :
 * Affiche deux boutons bascules avec un curseur d'arrière-plan animé.
 */
export function HomeModeToggle({ mode, onChange }: HomeModeToggleProps) {
  const { t } = useTranslation("global");

  return (
    <div className="relative flex p-1 mb-8 bg-zinc-900/60 rounded-xl mx-auto select-none backdrop-blur-sm">
      <div
        className={`absolute top-1 bottom-1 left-1 w-[144px] bg-zinc-800/90 rounded-lg shadow-sm transition-transform duration-200 ease-out ${
          mode === "create" ? "translate-x-0" : "translate-x-[144px]"
        }`}
      />

      <button
        type="button"
        onClick={() => onChange("create")}
        className={`relative z-10 w-[144px] text-center px-3 py-1.5 text-xs font-semibold tracking-wide transition-colors duration-200 cursor-pointer whitespace-nowrap ${
          mode === "create" ? "text-white" : "text-zinc-400 hover:text-zinc-200"
        }`}
      >
        {t("home.createTab")}
      </button>

      <button
        type="button"
        onClick={() => onChange("join")}
        className={`relative z-10 w-[144px] text-center px-3 py-1.5 text-xs font-semibold tracking-wide transition-colors duration-200 cursor-pointer whitespace-nowrap ${
          mode === "join" ? "text-white" : "text-zinc-400 hover:text-zinc-200"
        }`}
      >
        {t("home.joinTab")}
      </button>
    </div>
  );
}
