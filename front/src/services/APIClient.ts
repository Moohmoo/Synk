import axios from "axios";

export const API_BASE_URL =
  import.meta.env.VITE_API_URL || "http://localhost:8000";

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
  errorData: unknown,
  fallback = "Une erreur est survenue lors de la communication avec le serveur."
): string {
  if (!errorData || typeof errorData !== "object") return fallback;

  const errObj = errorData as Record<string, unknown>;

  // 1. Format enveloppé Synk : { error: { message: "..." } }
  if (
    errObj.error &&
    typeof errObj.error === "object" &&
    typeof (errObj.error as Record<string, unknown>).message === "string" &&
    ((errObj.error as Record<string, unknown>).message as string).trim()
  ) {
    return ((errObj.error as Record<string, unknown>).message as string).trim();
  }

  // 2. Erreur directe sous detail (ex: HTTP 404, 403, 500)
  if (typeof errObj.detail === "string" && errObj.detail.trim()) {
    return errObj.detail.trim();
  }

  // 3. Erreurs de validation Pydantic (HTTP 422 : liste d'erreurs loc / msg)
  if (Array.isArray(errObj.detail) && errObj.detail.length > 0) {
    const first = errObj.detail[0];
    if (first && typeof first === "object" && typeof (first as Record<string, unknown>).msg === "string") {
      return ((first as Record<string, unknown>).msg as string).trim();
    }
  }

  // 4. Propriété message directe
  if (typeof errObj.message === "string" && errObj.message.trim()) {
    return errObj.message.trim();
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
