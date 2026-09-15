import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import type { HomeMode } from "@/hooks/useHome";

interface HeadingProps {
  mode: HomeMode;
}

interface HeadingContent {
  titleKey: "home.createTitle" | "home.joinTitle";
  subtitleKey: "home.createSubtitle" | "home.joinSubtitle";
}

const HEADINGS: Record<HomeMode, HeadingContent> = {
  create: { titleKey: "home.createTitle", subtitleKey: "home.createSubtitle" },
  join: { titleKey: "home.joinTitle", subtitleKey: "home.joinSubtitle" },
};

/**
 * En-tête dynamique de la page d'accueil avec transition fluide sans saut de mise en page.
 */
export function Heading({ mode }: HeadingProps) {
  const { t } = useTranslation("global");

  return (
    <div className="grid grid-cols-1 grid-rows-1 place-items-center max-w-md text-center select-none">
      {(["create", "join"] as const).map((itemMode) => {
        const isActive = mode === itemMode;
        const { titleKey, subtitleKey } = HEADINGS[itemMode];

        return (
          <div
            key={itemMode}
            className={cn(
              "col-start-1 row-start-1 flex flex-col items-center transition-all duration-300 ease-out",
              isActive ? "opacity-100 scale-100" : "opacity-0 scale-95 pointer-events-none"
            )}
          >
            <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-zinc-100 mb-2.5">
              {t(titleKey)}
            </h1>
            <p className="text-sm font-normal text-zinc-400 mb-8 max-w-sm text-center leading-relaxed">
              {t(subtitleKey)}
            </p>
          </div>
        );
      })}
    </div>
  );
}

export default Heading;
