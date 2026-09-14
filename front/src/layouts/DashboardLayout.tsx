import { useState } from "react";
import { Outlet } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Menu } from "lucide-react";
import { LeftSidebar, LeftNavContent } from "@/components/LeftSidebar";
import { RightSidebar } from "@/components/RightSidebar";
import { Breadcrumb } from "@/components/Breadcrumb";
import { Logo } from "@/components/Logo";
import { AmbientGlow } from "@/components/shared";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

export function LanguageSwitcher() {
  const { i18n, t } = useTranslation("global");
  const currentLang = i18n.language?.startsWith("en") ? "en" : "fr";

  const changeLanguage = (lang: string) => {
    if (currentLang === lang) return;
    void i18n.changeLanguage(lang);
  };

  return (
    <div className="flex items-center font-mono text-xs select-none">
      <button
        type="button"
        onClick={() => changeLanguage("fr")}
        aria-label={t("nav.switchLanguageFr")}
        className={`transition-colors cursor-pointer ${
          currentLang === "fr"
            ? "text-zinc-100 font-medium"
            : "text-zinc-500 hover:text-zinc-300"
        }`}
      >
        FR
      </button>
      <span className="mx-2 text-zinc-700" aria-hidden="true">
        /
      </span>
      <button
        type="button"
        onClick={() => changeLanguage("en")}
        aria-label={t("nav.switchLanguageEn")}
        className={`transition-colors cursor-pointer ${
          currentLang === "en"
            ? "text-zinc-100 font-medium"
            : "text-zinc-500 hover:text-zinc-300"
        }`}
      >
        EN
      </button>
    </div>
  );
}

export function DashboardLayout() {
  const { t } = useTranslation("global");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    /* NIVEAU 0 (Le Mur / Root) : Noir absolu derrière l'application */
    <div className="h-screen w-screen flex bg-black relative overflow-hidden text-zinc-400 font-sans select-none">
      {/* Premier enfant absolu : Lueur d'ambiance globale GitLab */}
      <AmbientGlow />

      {/* NIVEAU 1 (La Sidebar) : Affichée à partir de lg (>= 1024px) */}
      <LeftSidebar className="hidden lg:flex" />

      {/* Tiroir Mobile/Tablette de navigation (< lg) */}
      <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
        <SheetContent side="left" className="w-64 p-4 pt-6 bg-zinc-950 border-r border-white/5 flex flex-col">
          <SheetHeader className="mb-6 px-2">
            <SheetTitle>
              <Logo onClick={() => setMobileMenuOpen(false)} />
            </SheetTitle>
          </SheetHeader>
          <LeftNavContent onItemClick={() => setMobileMenuOpen(false)} />
        </SheetContent>
      </Sheet>

      {/* NIVEAU 2 (Le Main Canvas incrusté) :
          - Mobile / Tablette (< lg) : 100% largeur & hauteur sans marges pour exploiter l'écran
          - Desktop (>= lg) : Nested Canvas incrusté avec mt-4 mr-4, rounded-t-2xl et bordures fines
      */}
      <div className="flex-1 w-full flex flex-col relative z-20 bg-zinc-900 overflow-hidden lg:mt-4 lg:mr-4 lg:rounded-t-2xl lg:border-t lg:border-x lg:border-white/5">
        {/* TOP NAVBAR (Délimitée par border-b border-white/5, paddings responsives) */}
        <header className="h-14 border-b border-white/5 flex items-center justify-between px-4 sm:px-6 lg:px-8 shrink-0 select-none bg-zinc-900">
          <div className="flex items-center gap-3 min-w-0">
            {/* Bouton burger pour tiroir navigation (< lg) */}
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden p-1.5 -ml-1.5 rounded-md text-zinc-400 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
              aria-label={t("nav.openMenu")}
            >
              <Menu className="w-5 h-5" />
            </button>

            {/* Fil d'Ariane (Breadcrumb) */}
            <Breadcrumb />
          </div>

          {/* Bouton de langue FR / EN */}
          <div className="shrink-0 ml-2">
            <LanguageSwitcher />
          </div>
        </header>

        {/* CONTENU CENTRAL DU CANVAS */}
        <div className="flex-1 flex flex-row relative overflow-hidden min-h-0 z-10">
          <main className="flex-1 min-w-0 overflow-y-auto flex flex-col relative z-10">
            <Outlet />
          </main>

          {/* Volet contextuel droit (participants en salon et/ou footer) */}
          <RightSidebar />
        </div>
      </div>
    </div>
  );
}

export default DashboardLayout;



