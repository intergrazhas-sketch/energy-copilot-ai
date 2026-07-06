"""Tests for batch import duplicate row accounting."""

import uuid

from app.services.batch_import import BatchResult, PerFileResult
from app.services.import_fingerprint import compute_upload_fingerprint


def test_batch_result_aggregates_duplicate_rows_skipped():
    batch = BatchResult(total_files=2)
    batch.actual_rows_imported = 10
    batch.forecast_rows_imported = 5
    batch.duplicate_rows_skipped = 105
    batch.processed_files = 2

    assert batch.duplicate_rows_skipped == 105
    assert batch.actual_rows_imported == 10
    assert batch.forecast_rows_imported == 5


def test_reimport_all_duplicates_is_not_zero_effect():
    """Re-uploading the same file should count duplicates, not new imports."""
    per_file = PerFileResult(
        filename="repeat.xlsx",
        status="success",
        actual_rows_imported=0,
        forecast_rows_imported=0,
        duplicate_rows_skipped=96,
    )

    assert per_file.actual_rows_imported == 0
    assert per_file.duplicate_rows_skipped == 96
    assert per_file.status == "success"


def test_upload_fingerprint_is_stable_for_same_payload():
    plant_id = uuid.UUID("11111111-1111-1111-1111-111111111111")
    files = [("a.xlsx", b"payload-a"), ("b.xlsx", b"payload-b")]
    first = compute_upload_fingerprint(plant_id, "actual_and_forecast", files)
    second = compute_upload_fingerprint(plant_id, "actual_and_forecast", list(reversed(files)))
    assert first == second


def test_upload_fingerprint_changes_with_mode_or_content():
    plant_id = uuid.UUID("11111111-1111-1111-1111-111111111111")
    files = [("a.xlsx", b"payload-a")]
    base = compute_upload_fingerprint(plant_id, "actual_and_forecast", files)
    other_mode = compute_upload_fingerprint(plant_id, "forecast_only", files)
    other_content = compute_upload_fingerprint(plant_id, "actual_and_forecast", [("a.xlsx", b"changed")])
    assert base != other_mode
    assert base != other_content
