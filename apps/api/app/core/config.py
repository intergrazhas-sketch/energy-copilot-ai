from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    service_name: str = "energy-copilot-api"
    version: str = "0.1.0"
    environment: str = "development"

    database_url: str = (
        "postgresql+asyncpg://ec_user:ec_secret_password@localhost:5432/energy_copilot"
    )
    redis_url: str = "redis://:ec_redis_password@localhost:6379/0"
    qdrant_host: str = "localhost"
    qdrant_port: int = 6333
    qdrant_api_key: str = "ec_qdrant_key"
    readiness_timeout_seconds: float = 3.0
    cors_origins: str = "http://localhost:3000,http://localhost:80"
    mqtt_host: str = "localhost"
    mqtt_port: int = 1883
    mqtt_user: str = "ec_mqtt"
    mqtt_password: str = "ec_mqtt_password"
    mqtt_actual_topic: str = "plants/#"
    mqtt_reconnect_seconds: float = 5.0
    mqtt_enabled: bool = True
    telemetry_revenue_per_kwh: float | None = None

    model_config = SettingsConfigDict(extra="ignore")

    @property
    def qdrant_url(self) -> str:
        return f"http://{self.qdrant_host}:{self.qdrant_port}/healthz"

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
