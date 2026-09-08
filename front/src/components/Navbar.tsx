import { useTranslation } from "react-i18next";
import { Logo } from "@/components/Logo";

export interface NavbarProps {
  className?: string;
}

export function Navbar({ className = "" }: NavbarProps) {
  const { i18n } = useTranslation("global");
  const currentLang = i18n.language?.startsWith("en") ? "en" : "fr";

  const changeLanguage = (lang: string) => {
    if (currentLang === lang) return;
    void i18n.changeLanguage(lang);
  };

  return (
    <header className={`w-full h-16 flex-shrink-0 z-10 bg-[#18181b] border-b border-white/10 select-none ${className}`}>
      <div className="w-full max-w-[1400px] mx-auto h-full flex items-center justify-between px-6">
        {/* Logo SYNK à gauche */}
        <Logo />

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
