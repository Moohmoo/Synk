"""
Exceptions métier et gestion d'erreurs sécurisée (Anti-Information Disclosure).

Principe de sécurité (OWASP API Security) :
- `message` : Message technique interne détaillé, consigné uniquement dans les logs serveur.
- `public_message` : Message aseptisé et sûr, renvoyé au client sans révéler d'implémentation.
- `code` : Code d'erreur stable pour le frontend (ex: 'ROOM_NOT_FOUND').
"""


class SynkError(Exception):
    """
    Classe de base pour toutes les erreurs applicatives Synk.
    Assure l'étanchéité entre les détails techniques internes et la réponse client.
    """

    def __init__(
        self,
        message: str,
        code: str = "INTERNAL_ERROR",
        public_message: str | None = None,
        status_code: int = 400,
    ):
        super().__init__(message)
        self.message = message
        self.code = code
        self.public_message = public_message or "Une erreur est survenue."
        self.status_code = status_code

    def __str__(self) -> str:
        return f"[{self.code}] {self.message}"


class RoomNotFoundError(SynkError):
    """Levée lorsqu'un salon est introuvable ou a expiré."""

    def __init__(self, room_id: str = ""):
        super().__init__(
            message=f"Room '{room_id}' not found in storage",
            code="ROOM_NOT_FOUND",
            public_message="Ce salon n'existe pas ou a expiré.",
            status_code=404,
        )


class InvalidHostTokenError(SynkError):
    """Levée lorsqu'une action requiert les droits d'hôte mais que le token est invalide."""

    def __init__(self, message: str = "Host token mismatch"):
        super().__init__(
            message=message,
            code="INVALID_HOST_TOKEN",
            public_message="Action non autorisée ou token d'administration invalide.",
            status_code=403,
        )


class RoomLockedError(SynkError):
    """Levée lorsqu'une action de lecture est tentée sur un salon verrouillé."""

    def __init__(self, message: str = "Room is locked by host"):
        super().__init__(
            message=message,
            code="ROOM_LOCKED",
            public_message="Le salon est actuellement verrouillé par l'hôte.",
            status_code=423,
        )


class DatabaseUnavailableError(SynkError):
    """Levée lorsque la base de données (Redis ou SQL) est inaccessible."""

    def __init__(self, original_error: Exception | None = None):
        super().__init__(
            message=f"Database connection failure: {original_error}",
            code="SERVICE_UNAVAILABLE",
            public_message="Le service est temporairement indisponible. Veuillez réessayer.",
            status_code=503,
        )


class InternalServerError(SynkError):
    """Levée pour les erreurs inattendues côté serveur (masque tout détail technique)."""

    def __init__(self, original_error: Exception | None = None):
        super().__init__(
            message=f"Internal unexpected error: {original_error}",
            code="INTERNAL_SERVER_ERROR",
            public_message="Une erreur inattendue est survenue. Veuillez réessayer ultérieurement.",
            status_code=500,
        )


class RateLimitExceededError(SynkError):
    """Levée lorsqu'un client dépasse les quotas de requêtes autorisés (HTTP 429)."""

    def __init__(
        self,
        message: str = "Rate limit exceeded",
        retry_after: int = 1,
        public_message: str | None = None,
    ):
        super().__init__(
            message=message,
            code="RATE_LIMIT_EXCEEDED",
            public_message=public_message
            or f"Trop de requêtes. Veuillez patienter {retry_after} seconde(s).",
            status_code=429,
        )
        self.retry_after = retry_after

