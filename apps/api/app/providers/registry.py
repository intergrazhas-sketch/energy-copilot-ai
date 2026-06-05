from app.providers.base import ForecastProviderAdapter
from app.providers.manual import ManualForecastProvider
from app.providers.mock import MockForecastProvider

_PROVIDERS: dict[str, ForecastProviderAdapter] = {
    ManualForecastProvider.code: ManualForecastProvider(),
    MockForecastProvider.code: MockForecastProvider(),
}


def get_provider_adapter(code: str) -> ForecastProviderAdapter | None:
    return _PROVIDERS.get(code)


def list_provider_adapters() -> list[ForecastProviderAdapter]:
    return list(_PROVIDERS.values())


def is_supported_provider(code: str) -> bool:
    return code in _PROVIDERS
