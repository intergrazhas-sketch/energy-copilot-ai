import asyncio
from collections.abc import Awaitable, Callable
from time import perf_counter
from typing import Any

import httpx
import redis.asyncio as redis
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine

from app.core.config import Settings, get_settings

DependencyCheck = Callable[[Settings], Awaitable[dict[str, Any]]]


async def check_postgres(settings: Settings) -> dict[str, Any]:
    engine = create_async_engine(settings.database_url, pool_pre_ping=True)

    try:
        async with engine.connect() as connection:
            await connection.execute(text("SELECT 1"))
        return {"status": "ok"}
    except Exception as exc:
        return {"status": "error", "message": str(exc)}
    finally:
        await engine.dispose()


async def check_redis(settings: Settings) -> dict[str, Any]:
    client = redis.from_url(settings.redis_url, encoding="utf-8", decode_responses=True)

    try:
        pong = await client.ping()
        if pong is True:
            return {"status": "ok"}
        return {"status": "error", "message": "Redis ping returned unexpected value"}
    except Exception as exc:
        return {"status": "error", "message": str(exc)}
    finally:
        await client.aclose()


async def check_qdrant(settings: Settings) -> dict[str, Any]:
    headers = {}
    if settings.qdrant_api_key:
        headers["api-key"] = settings.qdrant_api_key

    try:
        async with httpx.AsyncClient(timeout=settings.readiness_timeout_seconds) as client:
            response = await client.get(settings.qdrant_url, headers=headers)
        if response.is_success:
            return {"status": "ok"}
        return {
            "status": "error",
            "message": f"Qdrant returned HTTP {response.status_code}",
        }
    except Exception as exc:
        return {"status": "error", "message": str(exc)}


async def _timed_check(name: str, check: DependencyCheck, settings: Settings) -> tuple[str, dict[str, Any]]:
    started_at = perf_counter()
    result = await check(settings)
    result["latency_ms"] = round((perf_counter() - started_at) * 1000, 2)
    return name, result


async def check_dependencies(settings: Settings | None = None) -> dict[str, Any]:
    current_settings = settings or get_settings()
    checks: dict[str, DependencyCheck] = {
        "postgres": check_postgres,
        "redis": check_redis,
        "qdrant": check_qdrant,
    }

    results = await asyncio.gather(
        *[
            _timed_check(name, check, current_settings)
            for name, check in checks.items()
        ]
    )
    dependencies = dict(results)
    overall_status = (
        "ok"
        if all(result["status"] == "ok" for result in dependencies.values())
        else "degraded"
    )

    return {
        "status": overall_status,
        "dependencies": dependencies,
    }
