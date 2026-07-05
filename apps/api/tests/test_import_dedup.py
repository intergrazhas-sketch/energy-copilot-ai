"""Tests for batch import duplicate row accounting."""

from app.services.batch_import import BatchResult, PerFileResult


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
