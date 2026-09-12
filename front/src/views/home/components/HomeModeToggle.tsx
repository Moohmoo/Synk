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
    <div className="relative flex p-1 mb-8 bg-zinc-900/60 border border-white/5 rounded-lg shadow-inner w-max mx-auto backdrop-blur-sm select-none">
      {/* Glissière mécanique (curseur d'arrière-plan animé) */}
      <div
        className="absolute top-1 bottom-1 left-1 w-[130px] bg-zinc-700/50 border border-white/10 rounded-md transition-transform duration-300 ease-[cubic-bezier(0.2,0.9,0.3,1)] pointer-events-none"
        style={{
          transform: mode === "create" ? "translateX(0px)" : "translateX(130px)",
        }}
      />

      <button
        type="button"
        onClick={() => onChange("create")}
        className={`relative z-10 w-[130px] py-1.5 text-xs font-semibold tracking-wide transition-colors duration-200 cursor-pointer text-center ${
          mode === "create" ? "text-white" : "text-zinc-500 hover:text-zinc-300"
        }`}
      >
        {t("home.createTab")}
      </button>

      <button
        type="button"
        onClick={() => onChange("join")}
        className={`relative z-10 w-[130px] py-1.5 text-xs font-semibold tracking-wide transition-colors duration-200 cursor-pointer text-center ${
          mode === "join" ? "text-white" : "text-zinc-500 hover:text-zinc-300"
        }`}
      >
        {t("home.joinTab")}
      </button>
    </div>
  );
}
