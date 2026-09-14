import { useTranslation } from "react-i18next";

/**
 * Sélecteur de langue bilingue (Français / Anglais).
 * Bascule instantanément la langue de l'application via i18next.
 */
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

export default LanguageSwitcher;
