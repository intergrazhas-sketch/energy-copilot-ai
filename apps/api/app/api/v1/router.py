from fastapi import APIRouter

from app.api.v1 import (
    accuracy,
    actual_generation,
    forecast_providers,
    forecast_runs,
    solar_plants,
    system,
)

api_router = APIRouter(prefix="/api/v1")
api_router.include_router(system.router)
api_router.include_router(solar_plants.router)
api_router.include_router(forecast_providers.router)
api_router.include_router(forecast_runs.router)
api_router.include_router(actual_generation.router)
api_router.include_router(accuracy.router)
