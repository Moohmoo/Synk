import i18n from "@/i18n/i18n";

export const USERNAME_REGEX = /^[a-zA-Z0-9_\u00C0-\u017F-]{2,20}$/;

/**
 * Valide le pseudo utilisateur avec support i18n.
 * 
 * @param name - Le pseudo à tester
 * @param customTranslate - Fonction de traduction optionnelle (ex: t de useTranslation)
 * @returns Le message d'erreur traduit, ou null si valide.
 */
export function validateUsername(
  name: string,
  customTranslate?: (key: string, options?: any) => string
): string | null {
  const trimmed = name.trim();
  const t =
    customTranslate ||
    ((key: string, options?: any): string =>
      String(i18n.t(key, { ns: "validation", ...options })));

  if (!trimmed) {
    return t("username.required");
  }
  if (trimmed.length < 2) {
    return t("username.tooShort");
  }
  if (trimmed.length > 20) {
    return t("username.tooLong");
  }
  if (!USERNAME_REGEX.test(trimmed)) {
    return t("username.invalidCharacters");
  }
  return null;
}
