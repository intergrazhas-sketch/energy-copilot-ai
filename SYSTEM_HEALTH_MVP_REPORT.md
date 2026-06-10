# System Health / Monitoring MVP Report

## Summary

System Health / Monitoring MVP has been implemented as a real Dashboard section using existing backend data and the current Dashboard architecture.

No backend endpoints were added or changed.

## Backend Status Used

Existing backend endpoints:

- `GET /health`
- `GET /api/v1/system/status`
- `GET /api/v1/telemetry/summary`
- `GET /api/v1/telemetry/latest`
- `GET /api/v1/forecast-runs`

Current backend System Health coverage:

- API service status from `/health` and `/api/v1/system/status`.
- PostgreSQL / TimescaleDB readiness from `/api/v1/system/status`.
- Redis readiness from `/api/v1/system/status`.
- Qdrant readiness from `/api/v1/system/status`.
- Dependency latency and error messages where backend provides them.

Not currently exposed by backend:

- MQTT broker readiness.
- MQTT subscriber readiness.
- Web container status.
- Nginx status.
- Historical uptime or incident state.

For unavailable backend signals, the UI shows `Unknown` or `Not available` and does not use mock data.

## Implemented UI

- Replaced the System Status placeholder with a full System Health / Monitoring page.
- Added KPI cards:
  - Overall Platform Status
  - API Status
  - Database Status
  - Redis Status
  - Qdrant Status
  - MQTT Status
  - Data Freshness
  - Last Telemetry Update
- Added visual statuses:
  - Healthy
  - Warning
  - Critical
  - Unknown
- Added Service Health Summary panel.
- Added Operational Signals panel:
  - Last telemetry update
  - Data freshness
  - Last forecast update
  - Environment
  - Version
- Added Service Status table:
  - service name
  - status
  - latency
  - detail
- Added EN / RU / KZ translations for the new UI.

## Files Changed

- `apps/web/pages/index.tsx`
- `apps/web/messages/en.json`
- `apps/web/messages/ru.json`
- `apps/web/messages/kz.json`
- `SYSTEM_HEALTH_MVP_REPORT.md`

## Verification

Completed:

- `npm run build` completed successfully.
- IDE diagnostics showed no lint/type errors for edited frontend files.
- `GET http://localhost:3000` returned `200`.
- `GET http://localhost:3000/api/v1/system/status` returned `200`.
- `GET http://localhost:3000/api/v1/telemetry/summary?asset_id=...&from=...&to=...` returned `200`.
- `GET http://localhost:3000/api/v1/telemetry/rejected/summary` returned `200`.
- `GET http://localhost:3000/api/v1/accuracy-lab/summary?from=...&to=...&bucket=day` returned `200`.
- `GET http://localhost:3000/api/v1/forecast-runs` returned `200`.

Regression scope:

- Dashboard root loads.
- Telemetry backend proxy path responds.
- Data Quality backend proxy path responds.
- Forecast Accuracy Lab backend proxy path responds.
- Forecast run data is available for last forecast update calculation.

## Remaining Risks

- MQTT status is shown as `Unknown` because backend readiness does not expose MQTT broker or subscriber health.
- Last forecast update depends on `GET /api/v1/forecast-runs`; if there are no forecast runs, the UI shows no data.
- Data freshness depends on telemetry summary for the selected first available solar plant.
- Overall platform status is calculated from available live signals only, not from container-level observability.
- There is no historical uptime, incident timeline, alerting, or Prometheus/Grafana-grade monitoring yet.

## Recommended Next Step

Add backend readiness checks for MQTT broker and MQTT subscriber status, then extend the System Health page to show those signals as real Healthy / Warning / Critical states instead of Unknown.
