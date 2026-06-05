from app.providers.base import ForecastProviderAdapter


class MockForecastProvider(ForecastProviderAdapter):
    code = "mock"
    name = "Mock Forecast"
    provider_type = "mock"

    def describe(self) -> dict[str, str]:
        return {
            "code": self.code,
            "name": self.name,
            "provider_type": self.provider_type,
        }
