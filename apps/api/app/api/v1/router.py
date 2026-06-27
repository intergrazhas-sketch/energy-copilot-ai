from fastapi import APIRouter

from app.api.v1 import (
    accuracy,
    accuracy_lab,
    actual_generation,
    alerts,
    forecast_providers,
    forecast_runs,
    import_batch,
    provider_comparison,
    solar_plants,
    system,
    telemetry,
)

api_router = APIRouter(prefix="/api/v1")
api_router.include_router(system.router)
api_router.include_router(solar_plants.router)
api_router.include_router(forecast_providers.router)
api_router.include_router(forecast_runs.router)
api_router.include_router(actual_generation.router)
api_router.include_router(accuracy.router)
api_router.include_router(alerts.router)
api_router.include_router(provider_comparison.router)
api_router.include_router(accuracy_lab.router)
api_router.include_router(telemetry.router)
api_router.include_router(import_batch.router)
