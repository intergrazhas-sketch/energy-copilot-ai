import uuid

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.import_audit import ImportBatch, ImportError, ImportFile


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


async def get_batch_by_id(
    session: AsyncSession,
    batch_id: uuid.UUID,
) -> ImportBatch | None:
    result = await session.execute(select(ImportBatch).where(ImportBatch.id == batch_id))
    return result.scalar_one_or_none()


async def delete_batch_for_plant(
    session: AsyncSession,
    *,
    batch_id: uuid.UUID,
    plant_id: uuid.UUID,
) -> bool:
    batch = await get_batch_by_id(session, batch_id)
    if batch is None or batch.plant_id != plant_id:
        return False

    await session.delete(batch)
    await session.commit()
    return True


async def get_file_by_id(
    session: AsyncSession,
    file_id: uuid.UUID,
) -> ImportFile | None:
    result = await session.execute(select(ImportFile).where(ImportFile.id == file_id))
    return result.scalar_one_or_none()


def _recalculate_batch_counters(batch: ImportBatch, files: list[ImportFile]) -> None:
    batch.total_files = len(files)
    batch.processed_files = sum(1 for row in files if row.status in {"success", "partial"})
    batch.skipped_files = sum(1 for row in files if row.status == "skipped")
    batch.failed_files = sum(1 for row in files if row.status == "failed")
    batch.actual_rows_imported = sum(row.actual_rows_imported for row in files)
    batch.forecast_rows_imported = sum(row.forecast_rows_imported for row in files)
    batch.duplicate_rows_skipped = sum(row.duplicate_rows_skipped for row in files)
    batch.rejected_rows = sum(row.rejected_rows for row in files)

    starts = [row.data_start_at for row in files if row.data_start_at is not None]
    ends = [row.data_end_at for row in files if row.data_end_at is not None]
    batch.data_start_at = min(starts) if starts else None
    batch.data_end_at = max(ends) if ends else None

    if batch.total_files == 0:
        batch.status = "failed"
    elif batch.processed_files == 0:
        batch.status = "failed"
    elif batch.failed_files > 0 or batch.skipped_files > 0:
        batch.status = "partial_failed"
    else:
        batch.status = "success"


async def delete_file_for_plant(
    session: AsyncSession,
    *,
    file_id: uuid.UUID,
    plant_id: uuid.UUID,
) -> bool:
    import_file = await get_file_by_id(session, file_id)
    if import_file is None:
        return False

    batch = await get_batch_by_id(session, import_file.batch_id)
    if batch is None or batch.plant_id != plant_id:
        return False

    await session.execute(
        delete(ImportError).where(
            ImportError.batch_id == batch.id,
            ImportError.filename == import_file.filename,
        )
    )
    await session.delete(import_file)
    await session.flush()

    remaining = await session.execute(
        select(ImportFile)
        .where(ImportFile.batch_id == batch.id)
        .order_by(ImportFile.created_at.asc())
    )
    remaining_files = list(remaining.scalars().all())
    if not remaining_files:
        await session.delete(batch)
    else:
        _recalculate_batch_counters(batch, remaining_files)
        session.add(batch)

    await session.commit()
    return True
