# Data Quality & Rejected Telemetry MVP Report

## Summary

Data Quality / Rejected Telemetry UI MVP has been implemented as a real Dashboard section using existing backend APIs and the current Dashboard architecture.

No backend code or API contracts were changed.

## Implemented UI

- Replaced the Rejected Telemetry placeholder with a full Data Quality page.
- Added KPI cards:
  - Total Rejected Records
  - Rejection Rate
  - Top Rejection Reason
  - Affected Assets
- Added filters:
  - Period
  - Asset
  - Rejection Reason
- Added Top Rejection Reasons panel.
- Added visual Data Quality status:
  - Clean
  - Watch
  - Attention
- Added latest rejected records table with:
  - occurrence time
  - rejection reason
  - source
  - topic
  - asset / plant
  - resolution status
  - validation error message
- Added EN / RU / KZ translations for the new UI.

## Backend Endpoints Used

- `GET /api/v1/telemetry/rejected/summary`
- `GET /api/v1/telemetry/rejected`
- `GET /api/v1/telemetry/summary`
- `GET /api/v1/solar-plants`

The UI uses the rejected telemetry endpoints for quality data and existing telemetry summary counts to calculate the rejection rate against accepted telemetry points.

## Files Changed

- `apps/web/pages/index.tsx`
- `apps/web/messages/en.json`
- `apps/web/messages/ru.json`
- `apps/web/messages/kz.json`
- `docker-compose.yml`
- `DATA_QUALITY_MVP_REPORT.md`
- `DATA_QUALITY_PROXY_CHECK.md`

Existing untracked planning document:

- `NEXT_MODULE_ANALYSIS.md`

## Verification

Completed:

- `npm run build` completed successfully.
- Next.js production build compiled and generated static pages successfully.
- IDE diagnostics showed no lint/type errors for the edited frontend files.
- `http://localhost:3000` returned HTTP `200`.
- Docker stack is running.
- Docker `web` runtime proxy issue was fixed by setting `NEXT_DEV_BACKEND_URL=http://api:8000`.
- Same-origin proxy checks through `http://localhost:3000/api/...` now return `200`:
  - `GET http://localhost:3000/api/v1/telemetry/rejected/summary`
  - `GET http://localhost:3000/api/v1/telemetry/rejected?limit=5`
  - `GET http://localhost:3000/api/v1/telemetry/summary?asset_id=...&from=...&to=...`
- Direct backend checks:
  - `GET http://localhost:8000/health` returned `200`.
  - `GET http://localhost:8000/api/v1/telemetry/rejected/summary` returned `200`.
  - `GET http://localhost:8000/api/v1/telemetry/rejected?limit=5` returned `200`.
  - `GET http://localhost:8000/api/v1/solar-plants` returned `200`.

## Regression Scope

The implementation keeps the existing Dashboard data flow intact:

- Overview still uses the existing overview summary.
- Solar Plants remains unchanged.
- Forecast Accuracy Lab remains unchanged.
- Forecast Providers remains unchanged.
- Telemetry Dashboard remains unchanged.

The new Data Quality section fetches its own rejected telemetry data only when the Rejected Telemetry section is opened.

## Remaining Risks

- Rejection rate depends on accepted telemetry summary availability per asset.
- For all assets, accepted telemetry count is calculated by requesting telemetry summary for each known plant.
- The backend summary endpoint does not filter by rejection reason, so the UI filters top-level totals by reason client-side from the returned summary items.
- The latest records table uses the existing backend pagination limit and currently shows the latest 25 records in the UI.

## Recommended Next Step

The Data Quality MVP can be kept. The next pilot MVP module should be System Health / Monitoring, especially MQTT broker and subscriber readiness.
