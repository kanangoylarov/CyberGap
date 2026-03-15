from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    REDIS_HOST: str = "redis.honeypot.svc.cluster.local"
    REDIS_PORT: int = 6379
    REDIS_DB: int = 0
    GATEWAY_DB_URL: str = "postgresql+asyncpg://gateway:gatewaypass@postgres-gateway.honeypot.svc.cluster.local:5432/gatewaydb"
    AI_CLASSIFIER_URL: str = "http://ai-classifier.honeypot.svc.cluster.local:8000"
    STORE_BACKEND_HOST: str = "store-backend.honeypot.svc.cluster.local"
    STORE_BACKEND_PORT: int = 8000
    FINGERPRINT_TTL: int = 3600
    LOG_LEVEL: str = "INFO"

    class Config:
        env_prefix = "GATEWAY_"


settings = Settings()
