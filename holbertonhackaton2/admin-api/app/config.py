from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    GATEWAY_DB_URL: str = "postgresql+asyncpg://gateway:gatewaypass@postgres-gateway.honeypot.svc.cluster.local:5432/gatewaydb"
    LOG_LEVEL: str = "INFO"
    WS_POLL_INTERVAL: float = 2.0

    class Config:
        env_prefix = "ADMIN_"


settings = Settings()
