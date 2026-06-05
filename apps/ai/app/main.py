# ============================================================
#  Energy Copilot AI — AI Service Entry Point
#  Фаза 1: минимальный запуск
# ============================================================

from fastapi import FastAPI
import os

app = FastAPI(
    title="Energy Copilot AI — AI Service",
    description="Forecast Intelligence Engine, Forecast Accuracy Lab, AI Engineer",
    version="0.1.0",
    docs_url="/docs",
    openapi_url="/openapi.json",
)


@app.get("/health", tags=["System"])
async def health_check():
    return {
        "status": "ok",
        "service": "energy-copilot-ai",
        "version": "0.1.0",
        "modules": [
            "forecast_intelligence_engine",
            "forecast_accuracy_lab",
            "ai_engineer",
            "predictive_maintenance",
        ],
    }
