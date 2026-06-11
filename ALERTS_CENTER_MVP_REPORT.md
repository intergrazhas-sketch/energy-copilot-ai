# Alerts Center MVP Report

## Scope

Implemented a new frontend-only Dashboard section: **Alerts Center**.

The section computes operator alerts from current API responses for the Varvarinskaya SPP pilot. No backend endpoints, database tables, migrations, persistence, acknowledgement, snooze, rules engine, or business logic were changed.

## Existing APIs Used

- `/api/v1/system/status`
- `/api/v1/solar-plants`
- `/api/v1/telemetry/summary`
- `/api/v1/telemetry/rejected/summary`
- `/api/v1/accuracy-lab/summary`
- `/api/v1/accuracy-lab/providers/ranking`
- `/api/v1/forecast-runs`

## Frontend-Derived Alert Rules

Implemented computed alerts for:

- Telemetry stale/offline
- Telemetry data gap
- Rejected telemetry exists
- Critical top rejected reason
- MAPE above target `<10%`
- MAPE at or above baseline `14%`
- Provider worst MAPE above target
- Strong forecast bias
- No forecast runs
- Failed/pending forecast runs
- System dependency critical/offline/down/failed/error
- Solar plant inactive/missing

Alerts are sorted by severity and operator priority.

## UI Added

- Added **Alerts Center** to the left navigation.
- Added KPI cards:
  - Active Alerts
  - Critical Alerts
  - Warning Alerts
  - Forecast Alerts
  - Data Quality Alerts
  - System Alerts
  - Highest Severity
- Added Operator Priority card with the top 3-5 highest-priority alerts and recommended actions.
- Added current signal summary card for telemetry freshness, rejected telemetry, MAPE, and dependencies checked.
- Added Alerts Table with:
  - Severity
  - Category
  - Alert Type
  - Entity
  - Signal Value
  - Status: computed open
  - Source API
  - Recommended Action
- Added MVP limits note:
  - Alerts are computed from current API responses.
  - Persistence, acknowledgement, and history will be added later.

## UI Polish

- Removed horizontal scrolling from the Alerts Table.
- Removed the forced table row `min-width` that caused desktop overflow.
- Allowed long table text to wrap across multiple lines, especially for Entity, Signal Value, Source API, and Recommended Action.
- Compact column sizing was applied to Status and Source API.
- Added responsive fallback:
  - Two-column table layout below desktop width.
  - One-column table layout on small screens.

## i18n

Added EN/RU/KZ translations for:

- Navigation
- Severity and category labels
- KPI labels and helpers
- Alert type labels
- Signal value strings
- Recommended actions
- Empty/loading states
- MVP limits text

Technical identifiers remain unchanged where appropriate:

- API endpoint names
- Service names such as MQTT/SCADA
- Domain metric names such as MAPE
- Real asset/provider identifiers

## Files Changed

- `apps/web/pages/index.tsx`
- `apps/web/messages/en.json`
- `apps/web/messages/ru.json`
- `apps/web/messages/kz.json`
- `ALERTS_CENTER_MVP_REPORT.md`

## Verification

Build:

- `npm run build` completed successfully.
- Next.js compiled successfully and generated static pages.

Runtime:

- `http://localhost:3000` returned `200`.

API proxy checks with Dashboard-compatible query parameters:

- `/api/v1/system/status` returned `200`
- `/api/v1/solar-plants` returned `200`
- `/api/v1/telemetry/summary` returned `200`
- `/api/v1/telemetry/rejected/summary` returned `200`
- `/api/v1/accuracy-lab/summary` returned `200`
- `/api/v1/accuracy-lab/providers/ranking` returned `200`
- `/api/v1/forecast-runs` returned `200`

i18n checks:

- EN Alerts Center strings are present.
- RU Alerts Center strings are present.
- KZ Alerts Center strings are present.

Code quality checks:

- IDE diagnostics reported no linter errors for changed files.
- Locale JSON files parse successfully.
- `git diff --check` reported no whitespace errors, only standard Windows CRLF warnings.

## MVP Limits

This MVP is intentionally read-only and computed in the frontend.

Not implemented in this phase:

- Alert persistence
- Alert acknowledgement
- Snooze
- Alert history
- Backend rules engine
- Database schema changes
- Migrations

## Final Status

Alerts Center MVP is implemented and ready for manual review.

Commit was not created.
Push was not performed.
