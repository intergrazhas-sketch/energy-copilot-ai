from app.providers.base import ForecastProviderAdapter


class ManualForecastProvider(ForecastProviderAdapter):
    code = "manual"
    name = "Manual Forecast"
    provider_type = "manual"

    def describe(self) -> dict[str, str]:
        return {
            "code": self.code,
            "name": self.name,
            "provider_type": self.provider_type,
        }
