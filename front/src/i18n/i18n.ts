import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";

import globalFR from "./locales/fr/global.json";
import globalEN from "./locales/en/global.json";
import validationFR from "./locales/fr/validation.json";
import validationEN from "./locales/en/validation.json";
import roomFR from "./locales/fr/room.json";
import roomEN from "./locales/en/room.json";
import errorsFR from "./locales/fr/errors.json";
import errorsEN from "./locales/en/errors.json";

export const resources = {
  fr: {
    global: globalFR,
    validation: validationFR,
    room: roomFR,
    errors: errorsFR,
  },
  en: {
    global: globalEN,
    validation: validationEN,
    room: roomEN,
    errors: errorsEN,
  },
};

void i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: "fr",
    ns: ["global", "validation", "room", "errors"],
    defaultNS: "global",
    returnNull: true,
    debug: false,
    interpolation: {
      escapeValue: false, // Inutile avec React qui échappe nativement le XSS
    },
    detection: {
      order: ["localStorage", "navigator"],
      caches: ["localStorage"],
      lookupLocalStorage: "synk_language",
    },
  });

export default i18n;
