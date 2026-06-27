import io
import uuid
import zipfile
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db_session
from app.models.import_audit import ImportBatch, ImportError, ImportFile
from app.repositories import forecast as repository
from app.repositories import import_audit as audit_repository
from app.schemas.import_batch import (
    BatchImportFileResult,
    BatchImportHistoryItem,
    BatchImportHistoryResponse,
    BatchImportSummary,
)
from app.services.batch_import import IMPORT_MODES, BatchResult, run_batch_import

router = APIRouter(prefix="/import", tags=["Forecast MVP"])

MAX_FILES = 1000
MAX_TOTAL_BYTES = 200 * 1024 * 1024
MAX_SINGLE_FILE_BYTES = 30 * 1024 * 1024
MAX_ZIP_ENTRIES = 2000

_JUNK_PREFIXES = ("__MACOSX/", "__macosx/")


def _is_junk(name: str) -> bool:
    base = name.rsplit("/", 1)[-1]
    return name.startswith(_JUNK_PREFIXES) or base.startswith(".") or base == ""


def _expand_files(uploads: list[tuple[str, bytes]]) -> list[tuple[str, bytes]]:
    """Expand ZIP archives into their inner data files.

    Raises HTTP 400/413 with a clear message when safety limits are exceeded.
    """
    collected: list[tuple[str, bytes]] = []
    total_bytes = 0

    for filename, raw in uploads:
        lowered = (filename or "").lower()
        if lowered.endswith(".zip"):
            try:
                with zipfile.ZipFile(io.BytesIO(raw)) as archive:
                    infos = [i for i in archive.infolist() if not i.is_dir()]
                    if len(infos) > MAX_ZIP_ENTRIES:
                        raise HTTPException(
                            status_code=status.HTTP_400_BAD_REQUEST,
                            detail="zip_too_many_entries",
                        )
                    for info in infos:
                        if _is_junk(info.filename):
                            continue
                        if info.file_size > MAX_SINGLE_FILE_BYTES:
                            raise HTTPException(
                                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                                detail="file_too_large",
                            )
                        total_bytes += info.file_size
                        if total_bytes > MAX_TOTAL_BYTES:
                            raise HTTPException(
                                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                                detail="total_size_exceeded",
                            )
                        inner_name = info.filename.rsplit("/", 1)[-1]
                        collected.append((inner_name, archive.read(info)))
            except zipfile.BadZipFile as exc:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="invalid_zip",
                ) from exc
        else:
            if len(raw) > MAX_SINGLE_FILE_BYTES:
                raise HTTPException(
                    status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                    detail="file_too_large",
                )
            total_bytes += len(raw)
            if total_bytes > MAX_TOTAL_BYTES:
                raise HTTPException(
                    status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                    detail="total_size_exceeded",
                )
            collected.append((filename or "upload", raw))

        if len(collected) > MAX_FILES:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="too_many_files",
            )

    return collected


def _resolve_status(batch: BatchResult) -> str:
    if batch.processed_files == 0:
        return "failed"
    if batch.failed_files > 0 or batch.skipped_files > 0:
        return "partial_failed"
    return "success"


@router.post("/batch", response_model=BatchImportSummary)
async def batch_import(
    plant_id: uuid.UUID = Form(...),
    mode: str = Form("actual_and_forecast"),
    files: list[UploadFile] = File(...),
    session: AsyncSession = Depends(get_db_session),
):
    if mode not in IMPORT_MODES:
        raise HTTPException(status_code=400, detail="invalid_import_mode")

    plant = await repository.get_solar_plant(session, plant_id)
    if plant is None:
        raise HTTPException(status_code=404, detail="Solar plant not found")

    if not files:
        raise HTTPException(status_code=400, detail="no_files_uploaded")

    uploads: list[tuple[str, bytes]] = []
    for upload in files:
        uploads.append((upload.filename or "upload", await upload.read()))

    original_filename = uploads[0][0] if len(uploads) == 1 else f"{len(uploads)} files"
    expanded = _expand_files(uploads)

    if not expanded:
        raise HTTPException(status_code=400, detail="no_supported_files")
    if len(expanded) > MAX_FILES:
        raise HTTPException(status_code=400, detail="too_many_files")

    started_at = datetime.now(timezone.utc)
    audit_batch = ImportBatch(
        plant_id=plant_id,
        started_at=started_at,
        status="running",
        source="ui_batch_upload",
        import_mode=mode,
        original_filename=original_filename[:512],
        total_files=len(expanded),
    )
    session.add(audit_batch)
    await session.commit()
    await session.refresh(audit_batch)

    result = await run_batch_import(session, plant_id, mode, expanded)

    for per_file in result.files:
        session.add(
            ImportFile(
                batch_id=audit_batch.id,
                filename=per_file.filename[:512],
                file_type=per_file.file_type,
                status=per_file.status,
                actual_rows_imported=per_file.actual_rows_imported,
                forecast_rows_imported=per_file.forecast_rows_imported,
                rejected_rows=per_file.rejected_rows,
                data_start_at=per_file.data_start_at,
                data_end_at=per_file.data_end_at,
                error_message=per_file.error_message,
            )
        )
        for row_number, error_type, error_message in per_file.errors[:50]:
            session.add(
                ImportError(
                    batch_id=audit_batch.id,
                    filename=per_file.filename[:512],
                    row_number=row_number,
                    error_type=error_type[:64],
                    error_message=error_message[:2000],
                )
            )

    batch_status = _resolve_status(result)
    audit_batch.finished_at = datetime.now(timezone.utc)
    audit_batch.status = batch_status
    audit_batch.processed_files = result.processed_files
    audit_batch.skipped_files = result.skipped_files
    audit_batch.failed_files = result.failed_files
    audit_batch.actual_rows_imported = result.actual_rows_imported
    audit_batch.forecast_rows_imported = result.forecast_rows_imported
    audit_batch.rejected_rows = result.rejected_rows
    audit_batch.data_start_at = result.data_start_at
    audit_batch.data_end_at = result.data_end_at
    session.add(audit_batch)
    await session.commit()

    return BatchImportSummary(
        batch_id=audit_batch.id,
        plant_id=plant_id,
        import_mode=mode,
        status=batch_status,
        total_files=result.total_files,
        processed_files=result.processed_files,
        skipped_files=result.skipped_files,
        failed_files=result.failed_files,
        actual_rows_imported=result.actual_rows_imported,
        forecast_rows_imported=result.forecast_rows_imported,
        rejected_rows=result.rejected_rows,
        data_start_at=result.data_start_at,
        data_end_at=result.data_end_at,
        files=[
            BatchImportFileResult(
                filename=f.filename,
                file_type=f.file_type,
                status=f.status,
                actual_rows_imported=f.actual_rows_imported,
                forecast_rows_imported=f.forecast_rows_imported,
                rejected_rows=f.rejected_rows,
                data_start_at=f.data_start_at,
                data_end_at=f.data_end_at,
                error_message=f.error_message,
            )
            for f in result.files
        ],
    )


@router.get("/batches", response_model=BatchImportHistoryResponse)
async def list_import_batches(
    plant_id: uuid.UUID = Query(...),
    limit: int = Query(20, ge=1, le=50),
    session: AsyncSession = Depends(get_db_session),
):
    plant = await repository.get_solar_plant(session, plant_id)
    if plant is None:
        raise HTTPException(status_code=404, detail="Solar plant not found")

    batches = await audit_repository.list_recent_batches(session, plant_id=plant_id, limit=limit)
    files_by_batch = await audit_repository.list_files_for_batches(
        session, [batch.id for batch in batches]
    )

    items: list[BatchImportHistoryItem] = []
    for batch in batches:
        files = files_by_batch.get(batch.id, [])
        items.append(
            BatchImportHistoryItem(
                id=batch.id,
                status=batch.status,
                import_mode=batch.import_mode,
                source=batch.source,
                original_filename=batch.original_filename,
                started_at=batch.started_at,
                finished_at=batch.finished_at,
                created_at=batch.created_at,
                total_files=batch.total_files,
                processed_files=batch.processed_files,
                skipped_files=batch.skipped_files,
                failed_files=batch.failed_files,
                actual_rows_imported=batch.actual_rows_imported,
                forecast_rows_imported=batch.forecast_rows_imported,
                rejected_rows=batch.rejected_rows,
                data_start_at=batch.data_start_at,
                data_end_at=batch.data_end_at,
                message=batch.message,
                files=[
                    BatchImportFileResult(
                        filename=f.filename,
                        file_type=f.file_type,
                        status=f.status,
                        actual_rows_imported=f.actual_rows_imported,
                        forecast_rows_imported=f.forecast_rows_imported,
                        rejected_rows=f.rejected_rows,
                        data_start_at=f.data_start_at,
                        data_end_at=f.data_end_at,
                        error_message=f.error_message,
                    )
                    for f in files
                ],
            )
        )

    return BatchImportHistoryResponse(plant_id=plant_id, batches=items)
