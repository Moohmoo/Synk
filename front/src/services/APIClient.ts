import axios from "axios";

export const API_BASE_URL =
  (import.meta as any).env?.VITE_API_URL || "http://localhost:8000";

/**
 * Erreur normalisée pour tous les appels API de l'application Synk.
 * Garantit que `message` est toujours un string clair et jamais un objet.
 */
export class ApiError extends Error {
  status?: number;
  code?: string;
  fieldErrors?: Record<string, string>;
  requestId?: string;

  constructor(
    message: string,
    status?: number,
    code?: string,
    fieldErrors?: Record<string, string>,
    requestId?: string
  ) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.fieldErrors = fieldErrors;
    this.requestId = requestId;
  }
}

/**
 * Extrait un message d'erreur lisible (garanti de type string) depuis la réponse serveur.
 * Prévient définitivement l'apparition de `[object Object]`.
 */
export function extractApiErrorMessage(
  errorData: any,
  fallback = "Une erreur est survenue lors de la communication avec le serveur."
): string {
  if (!errorData) return fallback;

  // 1. Format enveloppé Synk : { error: { message: "..." } }
  if (typeof errorData.error?.message === "string" && errorData.error.message.trim()) {
    return errorData.error.message;
  }

  // 2. Erreur directe sous detail (ex: HTTP 404, 403, 500)
  if (typeof errorData.detail === "string" && errorData.detail.trim()) {
    return errorData.detail;
  }

  // 3. Erreurs de validation Pydantic (HTTP 422 : liste d'erreurs loc / msg)
  if (Array.isArray(errorData.detail) && errorData.detail.length > 0) {
    const first = errorData.detail[0];
    if (typeof first?.msg === "string" && first.msg.trim()) {
      return first.msg;
    }
  }

  // 4. Propriété message directe
  if (typeof errorData.message === "string" && errorData.message.trim()) {
    return errorData.message;
  }

  return fallback;
}

/**
 * Instance Axios centrale inspirée de l'architecture mankinds-app.
 */
export const axiosInstance = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

// Intercepteur pour normaliser toutes les erreurs réseau et API
axiosInstance.interceptors.response.use(
  (response) => response,
  (error) => {
    if (!error.response) {
      // Erreur de connexion réseau / serveur injoignable
      return Promise.reject(
        new ApiError(
          "Impossible de contacter le serveur. Vérifiez votre connexion.",
          0,
          "NETWORK_ERROR"
        )
      );
    }

    const { status, data, headers } = error.response;
    const message = extractApiErrorMessage(data, error.message);
    const code = data?.error?.code || (status === 422 ? "VALIDATION_ERROR" : "HTTP_ERROR");
    const fieldErrors = data?.error?.field_errors;
    const requestId = headers?.["x-request-id"] || data?.error?.request_id;

    return Promise.reject(
      new ApiError(message, status, code, fieldErrors, requestId)
    );
  }
);
