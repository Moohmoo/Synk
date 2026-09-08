import secrets
import traceback

from fastapi import FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

from core.exceptions import SynkError
from core.logger import logger


def _extract_request_id(request: Request) -> str:
    """Récupère l'en-tête X-Request-ID ou génère un identifiant unique aléatoire."""
    return request.headers.get("x-request-id") or f"req_{secrets.token_hex(4)}"


async def synk_domain_error_handler(request: Request, exc: SynkError) -> JSONResponse:
    """
    Gestionnaire pour les erreurs du domaine (Client-Facing).
    - Logge en interne le message technique confidentiel avec le request_id.
    - Renvoie au client une réponse aseptisée (public_message) avec code de statut adéquat.
    """
    request_id = _extract_request_id(request)
    logger.warning(
        f"[HTTP:{exc.status_code}] [{request_id}] {exc.code} sur {request.method} {request.url.path} : {exc.message}"
    )

    headers = {"X-Request-ID": request_id}
    if hasattr(exc, "retry_after") and exc.retry_after is not None:
        headers["Retry-After"] = str(exc.retry_after)

    return JSONResponse(
        status_code=exc.status_code,
        headers=headers,
        content={
            "detail": exc.public_message,
            "error": {
                "code": exc.code,
                "message": exc.public_message,
                "request_id": request_id,
            },
        },
    )


async def synk_validation_error_handler(
    request: Request, exc: RequestValidationError
) -> JSONResponse:
    """
    Gestionnaire pour les erreurs de validation de schéma Pydantic (HTTP 422).
    Fournit un format structuré et uniforme avec request_id.
    """
    request_id = _extract_request_id(request)
    logger.warning(
        f"[HTTP:422] [{request_id}] Validation error sur {request.method} {request.url.path}"
    )

    field_errors: dict[str, str] = {}
    for err in exc.errors():
        loc = err.get("loc", ())
        field_name = str(loc[-1]) if loc else "general"
        msg = err.get("msg", "Paramètre invalide.")
        msg = msg.removeprefix("Value error, ")
        field_errors[field_name] = msg

    first_error_msg = next(
        iter(field_errors.values()),
        "Les paramètres de la requête sont invalides ou incomplets.",
    )

    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        headers={"X-Request-ID": request_id},
        content={
            "detail": exc.errors(),
            "error": {
                "code": "VALIDATION_ERROR",
                "message": first_error_msg,
                "field_errors": field_errors,
                "request_id": request_id,
            },
        },
    )


async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    """
    Handler attrape-tout (Catch-All) pour toute exception imprévue ou crash interne (HTTP 500).
    - Logge le traceback Python complet côté serveur pour le debugging.
    - Masque 100% des détails techniques au client pour parer à toute fuite d'information.
    """
    request_id = _extract_request_id(request)
    tb_str = "".join(
        traceback.format_exception(type(exc), exc, exc.__traceback__)
    ).strip()

    logger.error(
        f"[HTTP:500] [{request_id}] Crash inattendu sur {request.method} {request.url.path} : {exc}\n{tb_str}"
    )

    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        headers={"X-Request-ID": request_id},
        content={
            "detail": "Une erreur inattendue est survenue. Veuillez réessayer ultérieurement.",
            "error": {
                "code": "INTERNAL_SERVER_ERROR",
                "message": "Une erreur inattendue est survenue. Veuillez réessayer ultérieurement.",
                "request_id": request_id,
            },
        },
    )


def register_exception_handlers(app: FastAPI) -> None:
    """Enregistre les gestionnaires d'exceptions personnalisés sur l'application FastAPI."""
    app.add_exception_handler(SynkError, synk_domain_error_handler)
    app.add_exception_handler(RequestValidationError, synk_validation_error_handler)
    app.add_exception_handler(Exception, unhandled_exception_handler)
