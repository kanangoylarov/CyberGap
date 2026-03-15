from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application settings loaded from environment variables with STORE_ prefix."""

    DATABASE_URL: str = "postgresql+asyncpg://store:storepass@postgres-store.honeypot.svc.cluster.local:5432/storedb"
    LOG_LEVEL: str = "INFO"
    DEFAULT_PAGE_SIZE: int = 20
    MAX_PAGE_SIZE: int = 100
    SESSION_COOKIE_NAME: str = "store_session_id"
    SESSION_COOKIE_MAX_AGE: int = 60 * 60 * 24 * 30  # 30 days

    model_config = {
        "env_prefix": "STORE_",
        "case_sensitive": False,
    }


settings = Settings()
