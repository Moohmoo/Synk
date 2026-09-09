import json
from functools import lru_cache
from pathlib import Path

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

BASE_DIR = Path(__file__).resolve().parent.parent.parent


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=(".env", str(BASE_DIR / ".env")),
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    APP_NAME: str = "Synk"
    PROJECT_NAME: str = "Synk API"
    VERSION: str = "0.1.0"
    ENV: str = "development"
    DEBUG: bool = False

    FRONT_URL: str = "http://localhost:5173"
    CORS_ORIGINS: list[str] = Field(
        default=[
            "http://localhost:5173",
            "http://localhost:3000",
            "http://127.0.0.1:5173",
            "http://127.0.0.1:3000",
        ],
    )

    @field_validator("CORS_ORIGINS", "TRUSTED_PROXIES", mode="before", check_fields=False)
    @classmethod
    def assemble_string_list(cls, v: str | list[str]) -> list[str]:
        if isinstance(v, str):
            v_stripped = v.strip()
            if v_stripped.startswith("[") and v_stripped.endswith("]"):
                try:
                    return json.loads(v_stripped)
                except json.JSONDecodeError:
                    pass
            return [
                item.strip() for item in v_stripped.split(",") if item.strip()
            ]
        return v

    TRUSTED_PROXIES: list[str] = Field(
        default=["127.0.0.1", "::1", "localhost", "testclient"],
        description="Liste des IP ou hôtes des proxys inverses de confiance pour la validation de X-Forwarded-For",
    )

    REDIS_URL: str = Field(
        ...,
        description="URL de connexion Redis obligatoire",
    )
    ROOM_TTL_SECONDS: int = 7200
    ROOM_EMPTY_TTL_SECONDS: int = 600
    ROOM_UNCLAIMED_TTL_SECONDS: int = 300

    MAX_PARTICIPANTS_PER_ROOM: int = 50
    MAX_ACTIVE_ROOMS: int = 1000

    WS_RATE_LIMIT_PER_SEC: int = 10
    WS_RATE_LIMIT_BURST: int = 15
    WS_MAX_PAYLOAD_SIZE: int = 65536

    RATE_LIMIT_ROOM_CREATE_PER_MIN: int = 15
    RATE_LIMIT_ROOM_CHECK_PER_MIN: int = 60
    RATE_LIMIT_WS_CONNECT_PER_MIN: int = 30

    WS_ACTION_LIMITS: dict[str, tuple[int, int]] = Field(
        default={
            "UPDATE_SETTINGS": (2, 2),
            "CHANGE_MEDIA": (2, 4),
            "PLAY": (3, 2),
            "PAUSE": (3, 2),
            "SEEK": (4, 2),
            "CHAT_MESSAGE": (5, 5),
            "HEARTBEAT": (2, 4),
        },
        description="Quotas de requêtes par action WebSocket : (max_requêtes, fenêtre_secondes)",
    )


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
