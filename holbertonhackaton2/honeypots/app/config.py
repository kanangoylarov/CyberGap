from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    HONEYPOT_TYPE: str = "generic"
    LOG_LEVEL: str = "DEBUG"
    RESPONSE_DELAY_MS: int = 0

    model_config = {"env_prefix": ""}


settings = Settings()
