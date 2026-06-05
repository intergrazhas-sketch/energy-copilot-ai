from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1.router import api_router
from app.core.config import get_settings

settings = get_settings()

app = FastAPI(
    title="Energy Copilot AI",
    description="Интеллектуальная операционная система для энергетических активов",
    version=settings.version,
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    openapi_url="/api/openapi.json",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router)


@app.get("/health", tags=["System"])
async def health_check():
    return {
        "status": "ok",
        "service": settings.service_name,
        "version": settings.version,
        "environment": settings.environment,
    }


@app.get("/", tags=["System"])
async def root():
    return {
        "message": "Energy Copilot AI — API работает",
        "docs": "/api/docs",
    }
