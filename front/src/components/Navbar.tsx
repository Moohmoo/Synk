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
    <header className={`w-full h-16 flex-shrink-0 z-10 bg-[#18181b] border-b border-white/10 select-none ${className}`}>
      <div className="w-full max-w-[1400px] mx-auto h-full flex items-center justify-between px-4 sm:px-6">
        {/* Section gauche : Menu mobile (< xl) + Logo */}
        <div className="flex items-center gap-3">
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
                <SheetTitle>
                  <Logo />
                </SheetTitle>
              </SheetHeader>
              <LeftNavContent onItemClick={() => setMobileNavOpen(false)} />
            </SheetContent>
          </Sheet>

          <Logo />
        </div>

        {/* Section droite : Toggle de langue FR / EN */}
        <div className="flex items-center p-1 bg-black/40 border border-white/10 rounded text-xs font-mono">
          <button
            type="button"
            onClick={() => changeLanguage("fr")}
            aria-label="Changer la langue en français"
            className={`px-2 py-0.5 rounded text-[11px] font-semibold transition-colors duration-150 ${
              currentLang === "fr"
                ? "bg-[#27272a] text-[#0ac8b9] shadow-sm"
                : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            FR
          </button>
          <button
            type="button"
            onClick={() => changeLanguage("en")}
            aria-label="Switch language to English"
            className={`px-2 py-0.5 rounded text-[11px] font-semibold transition-colors duration-150 ${
              currentLang === "en"
                ? "bg-[#27272a] text-[#0ac8b9] shadow-sm"
                : "text-zinc-500 hover:text-zinc-300"
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
