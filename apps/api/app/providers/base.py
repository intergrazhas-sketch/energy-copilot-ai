from abc import ABC, abstractmethod


class ForecastProviderAdapter(ABC):
    code: str
    name: str
    provider_type: str

    @abstractmethod
    def describe(self) -> dict[str, str]:
        """Return public provider metadata for registry/debug endpoints."""
