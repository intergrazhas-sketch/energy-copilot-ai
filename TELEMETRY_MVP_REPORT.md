# Telemetry MVP Report

## What Was Implemented

Telemetry MVP now has both backend and frontend coverage.

Backend:

- Added read-only API for accepted telemetry stored in the existing `actual_generation` table.
- Added latest telemetry lookup by asset/plant.
- Added historical telemetry lookup by asset/plant and time period.
- Added dashboard summary for accepted telemetry.
- Preserved existing Forecast Accuracy Lab, Forecast Providers, Solar Plants, and Rejected Telemetry behavior.

Frontend:

- Added a working Telemetry section inside the existing Dashboard sidebar.
- Added Telemetry Dashboard cards and signal status panel.
- Added a simple SVG power history chart using real backend data.
- Added RU / EN / KZ localization for all new Telemetry UI text.
- Preserved existing Overview, Solar Plants, Forecast Accuracy Lab, and Forecast Providers screens.

## Added Endpoints

- `GET /api/v1/telemetry/latest?asset_id=...`
- `GET /api/v1/telemetry/history?asset_id=...&from=...&to=...`
- `GET /api/v1/telemetry/summary?asset_id=...&from=...&to=...`

## Added Frontend Sections

- `Telemetry` dashboard section.
- Current telemetry KPI cards:
  - Current Power
  - Energy Today
  - Average Power
  - Max Power
  - Last Telemetry Time
  - Data Freshness Status
  - Telemetry Points Count
  - Possible Data Gap Minutes
  - Estimated Revenue Today, when returned by backend
- Power History chart.
- Telemetry Health / Signal Status card.

## Changed Files

Backend:

- `apps/api/app/api/v1/telemetry.py`
- `apps/api/app/core/config.py`
- `apps/api/app/repositories/telemetry.py`
- `apps/api/app/schemas/telemetry.py`
- `apps/api/app/services/telemetry.py`

Frontend:

- `apps/web/pages/index.tsx`
- `apps/web/messages/en.json`
- `apps/web/messages/ru.json`
- `apps/web/messages/kz.json`

Documentation:

- `TELEMETRY_MVP_REPORT.md`

## Verification Passed

Backend:

- Docker stack checked.
- `api`, `postgres`, `redis`, `qdrant`, `mqtt`, and `ai` containers were healthy.
- Existing read-only API endpoints returned `200`.
- New Telemetry endpoints returned `200`.
- Backend logs were checked for traceback/runtime errors.
- No runtime errors were found during regression.

Frontend:

- `npm run build` passed.
- Frontend returned `200` on `http://127.0.0.1:3000`.
- Telemetry endpoints worked through the frontend same-origin proxy.
- Navigation markers were present for:
  - Overview
  - Solar Plants
  - Forecast Accuracy Lab
  - Forecast Providers
  - Telemetry
- RU / EN / KZ language switcher remained available.
- Linter diagnostics showed no frontend errors.

## Remaining Risks

- Telemetry UI currently uses the first solar plant returned by the API; asset selection is not implemented yet.
- No realtime polling or WebSocket refresh is implemented.
- Accepted telemetry is stored as `actual_generation`; there is no separate raw accepted telemetry audit table yet.
- No device/inverter-level telemetry model exists yet.
- `estimated_revenue_today` is `null` until revenue configuration is provided.
- Backend tests are not added because the project does not yet have an API test structure.
- Data freshness thresholds are backend constants.

## Next Pilot MVP Step

The next pilot MVP step is to implement an asset-aware Telemetry UI flow:

- Add asset selection for Telemetry Dashboard.
- Add Rejected Telemetry full page.
- Add System Status full page.
- Add minimal backend/frontend tests before commit and push.
- Keep all UI text trilingual from the start.
