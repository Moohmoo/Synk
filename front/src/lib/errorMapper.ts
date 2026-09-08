import { TFunction } from "i18next";
import i18n from "@/i18n/i18n";
import { ApiError } from "@/services/APIClient";
import { ErrorPayload } from "@/types/events";

/**
 * Dictionnaire de correspondance pour associer d'anciens messages backend bruts
 * vers leurs codes d'erreur normalisés, garantissant une étanchéité i18n parfaite.
 */
const LEGACY_MESSAGE_MAP: Record<string, string> = {
  "URL de média invalide": "INVALID_MEDIA_URL",
  "Le salon est verrouillé par l'hôte": "ROOM_LOCKED",
  "Le salon est actuellement verrouillé par l'hôte.": "ROOM_LOCKED",
  "Seul l'hôte peut modifier les paramètres": "FORBIDDEN_HOST_ONLY",
  "Action non autorisée ou token d'administration invalide.": "INVALID_HOST_TOKEN",
  "Ce salon n'existe pas ou a expiré.": "ROOM_NOT_FOUND",
  "Salon introuvable": "ROOM_NOT_FOUND",
  "Format JSON invalide": "INVALID_JSON",
  "Payload de lecture invalide": "INVALID_PLAYBACK_PAYLOAD",
  "Payload de pause invalide": "INVALID_PLAYBACK_PAYLOAD",
  "Payload de saut temporel invalide": "INVALID_SEEK_PAYLOAD",
  "Message de chat invalide": "INVALID_CHAT_PAYLOAD",
  "Heartbeat invalide": "INVALID_HEARTBEAT",
  "Paramètres invalides": "INVALID_SETTINGS",
  "Impossible de contacter le serveur. Vérifiez votre connexion.": "NETWORK_ERROR",
  "Le service est temporairement indisponible. Veuillez réessayer.": "SERVICE_UNAVAILABLE",
  "Une erreur inattendue est survenue. Veuillez réessayer ultérieurement.": "INTERNAL_SERVER_ERROR",
};

/**
 * Formate et traduit n'importe quelle erreur applicative (API REST, WebSocket, Error JS ou string)
 * dans la langue active de l'utilisateur.
 *
 * Ordre de résolution :
 * 1. Code d'erreur normalisé (ex: "INVALID_MEDIA_URL" -> t("errors.INVALID_MEDIA_URL"))
 * 2. Correspondance de message hérité (si code générique "INVALID_PAYLOAD" ou absent)
 * 3. Fallback universel sécurisé ("UNKNOWN_ERROR")
 */
export function formatErrorMessage(
  error: ApiError | ErrorPayload | Error | string | unknown,
  customTranslate?: TFunction
): string {
  const t = customTranslate || ((key: string, options?: any) => i18n.t(key, options));

  if (!error) {
    return String(
      t("UNKNOWN_ERROR", {
        ns: "errors",
        defaultValue: "Une erreur inattendue est survenue.",
      })
    );
  }

  let code: string | undefined;
  let rawMessage: string | undefined;

  if (typeof error === "string") {
    rawMessage = error;
    code = LEGACY_MESSAGE_MAP[error] || error;
  } else if (typeof error === "object" && error !== null) {
    const errObj = error as any;
    code = errObj.code;
    rawMessage = errObj.message;
  }

  // Normalisation des alias
  if (code === "LOCKED") code = "ROOM_LOCKED";
  if (code === "FORBIDDEN") code = "FORBIDDEN_HOST_ONLY";

  // Si le code est générique ("INVALID_PAYLOAD" ou absent) mais qu'un message brut est connu
  if ((!code || code === "INVALID_PAYLOAD") && rawMessage && LEGACY_MESSAGE_MAP[rawMessage]) {
    code = LEGACY_MESSAGE_MAP[rawMessage];
  }

  // Résolution via le namespace i18n "errors"
  if (code) {
    const translated = String(t(code, { ns: "errors", defaultValue: "" }));
    if (translated && translated !== code && !translated.startsWith("errors.")) {
      return translated;
    }
  }

  // Fallback sécurisé : message d'erreur inconnu localisé
  return String(
    t("UNKNOWN_ERROR", {
      ns: "errors",
      defaultValue: "Une erreur inattendue est survenue.",
    })
  );
}
