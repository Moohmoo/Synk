import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import type { HomeMode } from "@/hooks/useHome";

interface ModeToggleProps {
  mode: HomeMode;
  onChange: (mode: HomeMode) => void;
}

const MODES: readonly { id: HomeMode; labelKey: "home.createTab" | "home.joinTab" }[] = [
  { id: "create", labelKey: "home.createTab" },
  { id: "join", labelKey: "home.joinTab" },
];

const BUTTON_WIDTH_PX = 130;

/**
 * Sélecteur de mode d'accueil (Créer / Rejoindre) :
 * Curseur mécanique sur rail avec calcul de translation déterministe.
 */
export function ModeToggle({ mode, onChange }: ModeToggleProps) {
  const { t } = useTranslation("global");
  const activeIndex = MODES.findIndex((item) => item.id === mode);

  return (
    <div className="relative flex p-1 mb-8 bg-zinc-800/70 border border-white/10 rounded-lg w-max mx-auto backdrop-blur-sm select-none">
      <div
        className="absolute top-1 bottom-1 left-1 w-[130px] bg-zinc-700 border border-white/10 rounded-md transition-transform duration-300 ease-[cubic-bezier(0.2,0.9,0.3,1)] pointer-events-none"
        style={{ transform: `translateX(${activeIndex * BUTTON_WIDTH_PX}px)` }}
      />

      {MODES.map(({ id, labelKey }) => {
        const isActive = mode === id;
        return (
          <button
            key={id}
            type="button"
            onClick={() => onChange(id)}
            className={cn(
              "relative z-10 w-[130px] py-1.5 text-xs font-semibold tracking-wide transition-colors duration-200 cursor-pointer text-center",
              isActive ? "text-white" : "text-zinc-400 hover:text-zinc-200"
            )}
          >
            {t(labelKey)}
          </button>
        );
      })}
    </div>
  );
}

export default ModeToggle;
