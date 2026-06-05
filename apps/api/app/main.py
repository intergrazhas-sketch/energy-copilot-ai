# ============================================================
#  Energy Copilot AI — FastAPI Entry Point
#  Фаза 1: минимальный запуск с health check
# ============================================================

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import os

app = FastAPI(
    title="Energy Copilot AI",
    description="Интеллектуальная операционная система для энергетических активов",
    version="0.1.0",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    openapi_url="/api/openapi.json",
)

# ── CORS настройки ───────────────────────────────────────────
origins = os.getenv("CORS_ORIGINS", "http://localhost:3000").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Health Check ─────────────────────────────────────────────
@app.get("/health", tags=["System"])
async def health_check():
    """
    Проверка работоспособности сервиса.
    Используется Docker для проверки состояния контейнера.
    """
    return {
        "status": "ok",
        "service": "energy-copilot-api",
        "version": "0.1.0",
        "environment": os.getenv("ENVIRONMENT", "development"),
    }


@app.get("/", tags=["System"])
async def root():
    return {
        "message": "Energy Copilot AI — API работает",
        "docs": "/api/docs",
    }
