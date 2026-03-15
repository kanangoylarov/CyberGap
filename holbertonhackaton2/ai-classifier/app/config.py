from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    LOG_LEVEL: str = "INFO"
    HOST: str = "0.0.0.0"
    PORT: int = 8000

    class Config:
        env_prefix = "CLASSIFIER_"


settings = Settings()
