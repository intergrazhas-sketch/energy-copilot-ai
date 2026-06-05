from fastapi import APIRouter, Response, status

from app.core.config import get_settings
from app.services.readiness import check_dependencies

router = APIRouter(prefix="/system", tags=["System"])


@router.get("/status")
async def system_status(response: Response):
    settings = get_settings()
    readiness = await check_dependencies(settings)

    if readiness["status"] != "ok":
        response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE

    return {
        "status": readiness["status"],
        "service": settings.service_name,
        "version": settings.version,
        "environment": settings.environment,
        "dependencies": readiness["dependencies"],
    }
