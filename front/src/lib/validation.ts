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
  customTranslate?: (key: string, options?: Record<string, unknown>) => string
): string | null {
  const trimmed = name.trim();
  const t =
    customTranslate ||
    ((key: string, options?: Record<string, unknown>): string =>
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

export const ROOM_CODE_REGEX = /^[a-zA-Z0-9_-]{4,32}$/;

/**
 * Valide le code salon avec support i18n.
 *
 * @param code - Le code salon à tester
 * @param customTranslate - Fonction de traduction optionnelle
 * @returns Le message d'erreur traduit, ou null si valide.
 */
export function validateRoomCode(
  code: string,
  customTranslate?: (key: string, options?: Record<string, unknown>) => string
): string | null {
  const trimmed = code.trim();
  const t =
    customTranslate ||
    ((key: string, options?: Record<string, unknown>): string =>
      String(i18n.t(key, { ns: "validation", ...options })));

  if (!trimmed) {
    return t("roomCode.required");
  }
  if (!ROOM_CODE_REGEX.test(trimmed)) {
    return t("roomCode.invalid");
  }
  return null;
}

