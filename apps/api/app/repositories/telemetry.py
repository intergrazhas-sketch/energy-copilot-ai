import uuid
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.telemetry import RejectedTelemetry
from app.schemas.telemetry import RejectedTelemetryResolutionStatus


async def create_rejected_telemetry(
    session: AsyncSession,
    *,
    source: str,
    topic: str,
    plant_id: uuid.UUID | None,
    reason: str,
    error_message: str,
    raw_payload_text: str,
    raw_payload_json: dict[str, Any] | list[Any] | None,
    metadata: dict[str, Any] | None = None,
) -> RejectedTelemetry:
    rejected = RejectedTelemetry(
        source=source,
        topic=topic,
        plant_id=plant_id,
        reason=reason,
        error_message=error_message,
        raw_payload_text=raw_payload_text,
        raw_payload_json=raw_payload_json,
        resolution_status=RejectedTelemetryResolutionStatus.open.value,
        metadata_json=metadata,
    )
    session.add(rejected)
    await session.commit()
    await session.refresh(rejected)
    return rejected


async def list_rejected_telemetry(
    session: AsyncSession,
    *,
    plant_id: uuid.UUID | None = None,
    reason: str | None = None,
    period_from: datetime | None = None,
    period_to: datetime | None = None,
    resolution_status: str | None = None,
    limit: int = 100,
    offset: int = 0,
) -> list[RejectedTelemetry]:
    statement = select(RejectedTelemetry)

    if plant_id is not None:
        statement = statement.where(RejectedTelemetry.plant_id == plant_id)
    if reason is not None:
        statement = statement.where(RejectedTelemetry.reason == reason)
    if period_from is not None:
        statement = statement.where(RejectedTelemetry.received_at >= period_from)
    if period_to is not None:
        statement = statement.where(RejectedTelemetry.received_at <= period_to)
    if resolution_status is not None:
        statement = statement.where(RejectedTelemetry.resolution_status == resolution_status)

    result = await session.execute(
        statement.order_by(RejectedTelemetry.received_at.desc()).limit(limit).offset(offset)
    )
    return list(result.scalars().all())


async def get_rejected_telemetry(
    session: AsyncSession,
    rejected_id: uuid.UUID,
) -> RejectedTelemetry | None:
    return await session.get(RejectedTelemetry, rejected_id)


async def update_rejected_resolution(
    session: AsyncSession,
    rejected: RejectedTelemetry,
    resolution_status: str,
) -> RejectedTelemetry:
    rejected.resolution_status = resolution_status
    rejected.resolved_at = (
        datetime.now(timezone.utc)
        if resolution_status in {
            RejectedTelemetryResolutionStatus.fixed.value,
            RejectedTelemetryResolutionStatus.ignored.value,
        }
        else None
    )
    await session.commit()
    await session.refresh(rejected)
    return rejected


async def summarize_rejected_telemetry(
    session: AsyncSession,
    *,
    plant_id: uuid.UUID | None = None,
    period_from: datetime | None = None,
    period_to: datetime | None = None,
    resolution_status: str | None = None,
) -> list[tuple[str, int]]:
    statement = select(RejectedTelemetry.reason, func.count(RejectedTelemetry.id)).group_by(
        RejectedTelemetry.reason
    )

    if plant_id is not None:
        statement = statement.where(RejectedTelemetry.plant_id == plant_id)
    if period_from is not None:
        statement = statement.where(RejectedTelemetry.received_at >= period_from)
    if period_to is not None:
        statement = statement.where(RejectedTelemetry.received_at <= period_to)
    if resolution_status is not None:
        statement = statement.where(RejectedTelemetry.resolution_status == resolution_status)

    result = await session.execute(statement.order_by(func.count(RejectedTelemetry.id).desc()))
    return [(row[0], row[1]) for row in result.all()]
