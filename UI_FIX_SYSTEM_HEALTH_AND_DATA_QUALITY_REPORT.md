# UI Fix Report: System Health And Data Quality

## Summary

Two remaining UI issues were investigated and addressed without changing backend, API contracts, or business logic.

## Rejected Telemetry Root Cause

The issue was not caused by rejected telemetry data or API responses.

The Data Quality KPI block had already been corrected to use four desktop columns, but the `Top Rejection Reason` KPI still rendered a translated text value with the same large numeric KPI style used for values like `2`, `5`, or percentages.

In Russian, the value `Некорректный JSON` is substantially wider than numeric values. With the shared `.metric-card strong` style, the text KPI used:

- large numeric font size
- tight numeric letter spacing
- single KPI value sizing intended for numbers

That made the text value visually collide with the neighboring `Affected Assets` KPI value.

## Rejected Telemetry Fix

The `MetricCard` component now supports an optional `valueClassName`.

Only the `Top Rejection Reason` KPI in `DataQualitySection` uses:

`metric-value-text`

Numeric KPI cards remain unchanged and keep the large numeric style.

The new text KPI style uses:

- smaller font size
- `line-height: 1.12`
- `max-width: 100%`
- `overflow-wrap: anywhere`
- `word-break: break-word`
- `white-space: normal`

The Data Quality KPI grid remains:

`grid-template-columns: repeat(4, minmax(0, 1fr))`

## System Status Root Cause

The current source code already contains `SystemHealthSection`.

The current render path is also correct:

`activeSection === "system-status"` renders `SystemHealthSection`.

`SectionPlaceholder` is now only the fallback for unknown sections.

Therefore, if the UI showed the old placeholder, the likely cause was a stale frontend runtime, stale browser state, or an older bundle still being served before the current System Health MVP code was loaded.

No backend change and no new API endpoint were required.

## System Status Verification

The current code path confirms:

- `SystemHealthSection` exists.
- `system-status` is routed to `SystemHealthSection`.
- `/api/v1/system/status` is used for real backend status data.
- Unknown or unavailable backend signals such as MQTT remain displayed as `Unknown` / `Not available`.

## Files Changed

- `apps/web/pages/index.tsx`
- `UI_FIX_SYSTEM_HEALTH_AND_DATA_QUALITY_REPORT.md`

## Checks Passed

- `npm run build` completed successfully.
- `GET http://localhost:3000` returned `200`.
- `GET http://localhost:3000/api/v1/system/status` returned `200`.
- `GET http://localhost:3000/api/v1/telemetry/rejected/summary` returned `200`.
- IDE diagnostics showed no linter errors for `apps/web/pages/index.tsx`.

## Visual Regression Notes

Screenshot files could not be generated in this environment because no headless browser executable was available in PATH:

- `msedge` not found
- `chrome` not found
- `chromium` not found

CSS/DOM regression was verified from the current source:

- RU `Top Rejection Reason` now uses compact multiline text KPI styling.
- EN uses the same text KPI styling for `Invalid JSON`.
- KZ uses the same text KPI styling for the translated rejection reason.
- Data Quality desktop KPI grid uses four equal columns.
- The `metric-card` has `min-width: 0`.
- The text KPI value can wrap inside the card instead of pushing into adjacent cards.
- Existing responsive breakpoints still collapse KPI grids at smaller widths.

Expected desktop behavior:

- 1280px: four KPI cards remain in one row with text KPI wrapping inside its card.
- 1440px: four KPI cards remain in one row with more horizontal room.
- 1920px: four KPI cards remain in one row without overlap.

## Keep All Decision

Yes, this fix is limited to frontend UI and can be kept.
