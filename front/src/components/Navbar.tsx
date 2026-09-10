import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Menu } from "lucide-react";
import { Logo } from "@/components/Logo";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { LeftNavContent } from "@/components/LeftSidebar";

export interface NavbarProps {
  className?: string;
}

export function Navbar({ className = "" }: NavbarProps) {
  const { t, i18n } = useTranslation("global");
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const currentLang = i18n.language?.startsWith("en") ? "en" : "fr";

  const changeLanguage = (lang: string) => {
    if (currentLang === lang) return;
    void i18n.changeLanguage(lang);
  };

  return (
    <header className={`w-full h-16 flex-shrink-0 z-20 bg-[#111114] shadow-md select-none ${className}`}>
      <div className="w-full max-w-[1400px] mx-auto h-full flex items-center justify-between px-4 sm:px-6">
        {/* Section gauche : Menu mobile (< xl) + Logo */}
        <div className="flex items-center gap-3 shrink-0">
          <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
            <SheetTrigger asChild>
              <button
                type="button"
                className="xl:hidden p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/5 transition-colors border border-white/5 cursor-pointer"
                aria-label={t("nav.openMenu", { defaultValue: "Ouvrir le menu de navigation" })}
              >
                <Menu className="w-5 h-5" />
              </button>
            </SheetTrigger>
            <SheetContent side="left" className="w-72 p-4 pt-6">
              <SheetHeader className="mb-6 px-2">
                <SheetTitle className="w-fit">
                  <Logo onClick={() => setMobileNavOpen(false)} />
                </SheetTitle>
              </SheetHeader>
              <LeftNavContent onItemClick={() => setMobileNavOpen(false)} />
            </SheetContent>
          </Sheet>

          <Logo />
        </div>

        {/* Section droite : Toggle de langue FR / EN */}
        <div className="flex items-center gap-1.5 text-xs font-mono select-none">
          <button
            type="button"
            onClick={() => changeLanguage("fr")}
            aria-label="Changer la langue en français"
            className={`px-1.5 py-0.5 text-[11px] font-semibold tracking-wider transition-all duration-150 cursor-pointer border-b-2 ${
              currentLang === "fr"
                ? "text-[#0ac8b9] border-[#0ac8b9] bg-gradient-to-t from-[#0ac8b9]/15 to-transparent"
                : "text-zinc-500 border-transparent hover:text-zinc-300 hover:border-[#0ac8b9]/40"
            }`}
          >
            FR
          </button>
          <span className="text-zinc-700 select-none text-[10px]" aria-hidden="true">
            /
          </span>
          <button
            type="button"
            onClick={() => changeLanguage("en")}
            aria-label="Switch language to English"
            className={`px-1.5 py-0.5 text-[11px] font-semibold tracking-wider transition-all duration-150 cursor-pointer border-b-2 ${
              currentLang === "en"
                ? "text-[#0ac8b9] border-[#0ac8b9] bg-gradient-to-t from-[#0ac8b9]/15 to-transparent"
                : "text-zinc-500 border-transparent hover:text-zinc-300 hover:border-[#0ac8b9]/40"
            }`}
          >
            EN
          </button>
        </div>
      </div>
    </header>
  );
}

export default Navbar;
