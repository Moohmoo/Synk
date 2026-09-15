import { useState } from "react";
import { Outlet } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Menu } from "lucide-react";
import { LeftSidebar, LeftNavContent } from "@/components/LeftSidebar";
import { RightSidebar } from "@/components/RightSidebar";
import { Logo } from "@/components/Logo";
import { SidebarSettings } from "@/components/SidebarSettings";
import { AmbientGlow } from "@/components/shared";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

export function AppLayout() {
  const { t } = useTranslation("global");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    /* NIVEAU 0 (Le Mur / Root) : Noir absolu derrière l'application */
    <div className="h-screen w-screen flex bg-black relative overflow-hidden text-zinc-400 font-sans select-none">
      {/* Premier enfant absolu : Lueur d'ambiance globale */}
      <AmbientGlow />

      {/* NIVEAU 1 (La Sidebar) : Affichée à partir de lg (>= 1024px) */}
      <LeftSidebar className="hidden lg:flex" />

      {/* Tiroir Mobile/Tablette de navigation (< lg) */}
      <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
        <SheetContent side="left" className="w-64 p-4 pt-6 bg-zinc-950/90 backdrop-blur-xl border-r border-white/5 flex flex-col">
          <SheetHeader className="mb-6 px-2">
            <SheetTitle>
              <Logo onClick={() => setMobileMenuOpen(false)} />
            </SheetTitle>
          </SheetHeader>
          <LeftNavContent onItemClick={() => setMobileMenuOpen(false)} />

          {/* Préférences globales et langue en bas du tiroir mobile */}
          <div className="mt-auto border-t border-white/5 pt-3">
            <SidebarSettings isCollapsed={false} />
          </div>
        </SheetContent>
      </Sheet>

      {/* NIVEAU 2 (Le Main Canvas incrusté) :
          - Mobile / Tablette (< lg) : 100% largeur & hauteur sans marges pour exploiter l'écran
          - Desktop (>= lg) : Nested Canvas incrusté avec mt-4 mr-4, rounded-t-2xl et bordures fines
      */}
      <div className="flex-1 w-full flex flex-col relative z-20 bg-zinc-900 overflow-hidden lg:mt-4 lg:mr-4 lg:rounded-t-2xl lg:border-t lg:border-x lg:border-white/5">
        {/* Bouton burger mobile (< lg) : Flottant et ultra-discret, zéro perte de hauteur */}
        <button
          type="button"
          onClick={() => setMobileMenuOpen(true)}
          className="lg:hidden absolute top-3 left-3 z-30 p-2 rounded-md bg-black/50 backdrop-blur-md border border-white/10 text-zinc-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          aria-label={t("nav.openMenu")}
        >
          <Menu className="w-4 h-4" />
        </button>

        {/* CONTENU CENTRAL DU CANVAS (Plein cadre sans topbar, pt-0) */}
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

export default AppLayout;



