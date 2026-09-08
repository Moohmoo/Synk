from fastapi import (
    APIRouter,
    Depends,
    Header,
    Query,
    WebSocket,
    status,
)
from pydantic import BaseModel, ConfigDict, Field

from core.config import settings
from core.rate_limiter import create_http_rate_limiter
from domains.room.index import (
    check_room,
    create_room,
    delete_room,
)
from domains.room.websocket import room_ws

# Routeur unifié pour les salons (préfixé par /api/v1/rooms dans main.py)
router = APIRouter(tags=["Rooms"])

# Dépendances de limitation de débit HTTP (Anti-Spam / Anti-Flood)
rate_limit_create_room = create_http_rate_limiter(
    requests_per_window=settings.RATE_LIMIT_ROOM_CREATE_PER_MIN,
    window_seconds=60,
    key_prefix="http:room_create",
    error_message="Trop de créations de salons. Veuillez patienter avant de réessayer.",
)

rate_limit_check_room = create_http_rate_limiter(
    requests_per_window=settings.RATE_LIMIT_ROOM_CHECK_PER_MIN,
    window_seconds=60,
    key_prefix="http:room_check",
    error_message="Trop de vérifications de salons. Veuillez patienter avant de réessayer.",
)

# ======================================================================
# Schémas Pydantic pour les requêtes et réponses
# ======================================================================

class RoomCreateRequest(BaseModel):
    """Payload pour la création d'un salon (POST /api/v1/rooms)."""

    model_config = ConfigDict(from_attributes=True)

    username: str = Field(
        ...,
        min_length=2,
        max_length=20,
        pattern=r"^[a-zA-Z0-9_\u00C0-\u017F-]{2,20}$",
        description="Pseudo du créateur (2 à 20 caractères alphanumériques avec accents autorisés, tiret ou underscore)",
    )


class RoomCreateResponse(BaseModel):
    """Réponse lors de la création d'un salon (201 Created)."""

    model_config = ConfigDict(from_attributes=True)

    room_id: str = Field(..., description="Identifiant unique du salon généré")
    host_token: str = Field(
        ..., description="Token secret d'administration pour l'hôte"
    )
    user_id: str = Field(..., description="Identifiant unique assigné à l'hôte")


class RoomCheckResponse(BaseModel):
    """Réponse lors de la vérification d'existence d'un salon (GET /api/v1/rooms/{room_id})."""

    model_config = ConfigDict(from_attributes=True)

    exists: bool = Field(..., description="Indique si le salon existe dans Redis")
    participant_count: int = Field(
        default=0,
        description="Nombre de participants actuellement connectés",
    )

# ======================================================================
# Endpoints HTTP REST
# ======================================================================

@router.post(
    "",
    response_model=RoomCreateResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Créer un nouveau salon de synchronisation",
    dependencies=[Depends(rate_limit_create_room)],
)
async def create_room_endpoint(payload: RoomCreateRequest) -> RoomCreateResponse:
    """Crée un salon Synk et retourne les identifiants de l'hôte."""
    room, host_token = await create_room(payload.username)

    return RoomCreateResponse(
        room_id=room.room_id,
        host_token=host_token,
        user_id=room.host_id,
    )


@router.get(
    "/{room_id}",
    response_model=RoomCheckResponse,
    status_code=status.HTTP_200_OK,
    summary="Vérifier l'existence et l'état d'un salon",
    dependencies=[Depends(rate_limit_check_room)],
)
async def check_room_endpoint(room_id: str) -> RoomCheckResponse:
    """Vérifie si un salon existe et retourne le nombre de participants."""
    exists, participant_count = await check_room(room_id)

    return RoomCheckResponse(
        exists=exists,
        participant_count=participant_count,
    )


@router.delete(
    "/{room_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Détruire un salon de synchronisation",
)
async def delete_room_endpoint(
    room_id: str,
    x_host_token: str = Header(
        ..., description="Token secret d'administration de l'hôte"
    ),
) -> None:
    """
    Supprime un salon avec vérification du token hôte.
    Les exceptions métier (RoomNotFoundError, InvalidHostTokenError) sont
    automatiquement interceptées par le gestionnaire d'exceptions global.
    """
    await delete_room(room_id, x_host_token)


# ======================================================================
# Endpoint Temps Réel WebSocket (Sous-ressource du Salon)
# ======================================================================


@router.websocket("/{room_id}/ws")
async def room_websocket_endpoint(
    websocket: WebSocket,
    room_id: str,
    username: str = Query(..., min_length=2, max_length=20),
    token: str | None = Query(None),
    user_id: str | None = Query(None),
) -> None:
    """
    Point d'entrée WebSocket canonique : délègue le cycle de vie
    de la session au gestionnaire temps réel du domaine.
    Accessible sur : /api/v1/rooms/{room_id}/ws
    """
    await room_ws.handle_connection(
        websocket=websocket,
        room_id=room_id,
        username=username,
        token=token,
        user_id=user_id,
    )
