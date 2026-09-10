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
    <div className="inline-flex items-center justify-center mb-6 select-none border-b border-white/10">
      <button
        type="button"
        onClick={() => onChange("create")}
        className={`w-36 sm:w-44 py-2.5 text-center text-sm font-medium tracking-wide transition-all duration-200 border-b-2 -mb-px cursor-pointer ${
          mode === "create"
            ? "text-white border-[#0ac8b9] bg-gradient-to-t from-[#0ac8b9]/15 to-transparent"
            : "text-zinc-500 border-transparent hover:text-zinc-300 hover:bg-gradient-to-t hover:from-[#0ac8b9]/10 hover:to-transparent hover:border-[#0ac8b9]/40"
        }`}
      >
        {t("home.createTab")}
      </button>

      <button
        type="button"
        onClick={() => onChange("join")}
        className={`w-36 sm:w-44 py-2.5 text-center text-sm font-medium tracking-wide transition-all duration-200 border-b-2 -mb-px cursor-pointer ${
          mode === "join"
            ? "text-white border-[#0ac8b9] bg-gradient-to-t from-[#0ac8b9]/15 to-transparent"
            : "text-zinc-500 border-transparent hover:text-zinc-300 hover:bg-gradient-to-t hover:from-[#0ac8b9]/10 hover:to-transparent hover:border-[#0ac8b9]/40"
        }`}
      >
        {t("home.joinTab")}
      </button>
    </div>
  );
}
