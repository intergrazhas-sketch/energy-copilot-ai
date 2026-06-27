import uuid
from datetime import datetime

from pydantic import BaseModel


class BatchImportFileResult(BaseModel):
    filename: str
    file_type: str
    status: str
    actual_rows_imported: int
    forecast_rows_imported: int
    rejected_rows: int
    data_start_at: datetime | None = None
    data_end_at: datetime | None = None
    error_message: str | None = None


class BatchImportSummary(BaseModel):
    batch_id: uuid.UUID
    plant_id: uuid.UUID
    import_mode: str
    status: str
    total_files: int
    processed_files: int
    skipped_files: int
    failed_files: int
    actual_rows_imported: int
    forecast_rows_imported: int
    rejected_rows: int
    data_start_at: datetime | None = None
    data_end_at: datetime | None = None
    files: list[BatchImportFileResult]
