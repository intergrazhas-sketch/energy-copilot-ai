"""Campbell Scientific TOA5 weather-station export detection.

These ``.xls`` files come from the Varvarinskaya meteo archive. They must not
be mixed with generation imports. Batch import classifies them and returns a
clear skip reason until a dedicated weather_observations pipeline exists.
"""

from __future__ import annotations

import io

TOA5_MARKERS = ("toa5",)
WEATHER_COLUMN_MARKERS = (
    "timestamp",
    "slrw_avg",
    "slrw_2_avg",
    "t107_c_avg",
    "cs241t_c_avg",
    "battv_avg",
    "battv_min",
)


def _normalize(cell: object) -> str:
    return str(cell).strip().lower().replace(" ", "_")


def _first_rows_xls(raw: bytes, max_rows: int = 6) -> list[list[str]]:
    import xlrd

    book = xlrd.open_workbook(file_contents=raw, on_demand=True)
    try:
        sheet = book.sheet_by_index(0)
        rows: list[list[str]] = []
        for r in range(min(max_rows, sheet.nrows)):
            rows.append([_normalize(sheet.cell_value(r, c)) for c in range(sheet.ncols)])
        return rows
    finally:
        book.release_resources()


def _first_rows_xlsx(raw: bytes, max_rows: int = 6) -> list[list[str]]:
    from openpyxl import load_workbook

    workbook = load_workbook(io.BytesIO(raw), read_only=True, data_only=True)
    try:
        sheet = workbook[workbook.sheetnames[0]]
        rows: list[list[str]] = []
        for i, row in enumerate(sheet.iter_rows(values_only=True)):
            rows.append([_normalize(cell) for cell in row])
            if i + 1 >= max_rows:
                break
        return rows
    finally:
        workbook.close()


def is_campbell_toa5(filename: str | None, raw: bytes) -> bool:
    """Return True when the file looks like a Campbell TOA5 weather export."""
    lowered = (filename or "").lower()
    try:
        if lowered.endswith(".xls"):
            rows = _first_rows_xls(raw)
        elif lowered.endswith((".xlsx", ".xlsm")):
            rows = _first_rows_xlsx(raw)
        else:
            return False
    except Exception:
        return False

    if not rows:
        return False

    first_cell = rows[0][0] if rows[0] else ""
    if any(marker in first_cell for marker in TOA5_MARKERS):
        return True

    # Fallback: header row contains TIMESTAMP + irradiance columns.
    header_hits = 0
    for row in rows[:4]:
        joined = " ".join(row)
        if "timestamp" in joined:
            header_hits += 1
        for marker in WEATHER_COLUMN_MARKERS:
            if marker in joined:
                header_hits += 1
    return header_hits >= 3
