import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.import_audit import ImportBatch, ImportFile


async def list_recent_batches(
    session: AsyncSession,
    *,
    plant_id: uuid.UUID,
    limit: int = 20,
) -> list[ImportBatch]:
    result = await session.execute(
        select(ImportBatch)
        .where(ImportBatch.plant_id == plant_id)
        .order_by(ImportBatch.created_at.desc())
        .limit(limit)
    )
    return list(result.scalars().all())


async def list_files_for_batches(
    session: AsyncSession,
    batch_ids: list[uuid.UUID],
) -> dict[uuid.UUID, list[ImportFile]]:
    if not batch_ids:
        return {}
    result = await session.execute(
        select(ImportFile)
        .where(ImportFile.batch_id.in_(batch_ids))
        .order_by(ImportFile.created_at.asc())
    )
    grouped: dict[uuid.UUID, list[ImportFile]] = {}
    for row in result.scalars().all():
        grouped.setdefault(row.batch_id, []).append(row)
    return grouped
