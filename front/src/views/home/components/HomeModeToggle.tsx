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
    <div className="relative flex p-1 mb-8 bg-[#18181b] rounded-md border border-white/5 mx-auto select-none">
      <div
        className={`absolute top-1 bottom-1 left-1 w-[120px] bg-[#27272a] rounded shadow-sm transition-transform duration-300 ease-out ${
          mode === "create" ? "translate-x-0" : "translate-x-[120px]"
        }`}
      />

      <button
        type="button"
        onClick={() => onChange("create")}
        className={`relative z-10 w-[120px] text-center px-3 py-1.5 text-xs font-medium transition-colors duration-300 ${
          mode === "create" ? "text-white" : "text-zinc-500 hover:text-zinc-300"
        }`}
      >
        {t("home.createTab")}
      </button>

      <button
        type="button"
        onClick={() => onChange("join")}
        className={`relative z-10 w-[120px] text-center px-3 py-1.5 text-xs font-medium transition-colors duration-300 ${
          mode === "join" ? "text-white" : "text-zinc-500 hover:text-zinc-300"
        }`}
      >
        {t("home.joinTab")}
      </button>
    </div>
  );
}
