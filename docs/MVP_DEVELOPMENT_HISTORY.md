# MVP Development History

This document consolidates the technical MVP reports that were created during Energy Copilot Dashboard development. The original root-level reports were merged here to keep the repository root focused on long-lived project documents.

## Protected Root Documents

These root documents are intentionally kept outside this cleanup:

- `README.md`
- `PLAN.md`
- `ROADMAP.md`
- `ARCHITECTURE_AUDIT.md`

## Source Reports Consolidated

- `PHASE1_REPORT.md`
- `PILOT_MVP_STATUS.md`
- `NEXT_MODULE_ANALYSIS.md`
- `TELEMETRY_MVP_REPORT.md`
- `DATA_QUALITY_MVP_REPORT.md`
- `DATA_QUALITY_PROXY_CHECK.md`
- `SYSTEM_HEALTH_MVP_REPORT.md`
- `UI_FIX_SYSTEM_HEALTH_AND_DATA_QUALITY_REPORT.md`
- `SYSTEM_HEALTH_LOCALIZATION_FIX_REPORT.md`
- `SYSTEM_HEALTH_LOCALIZATION_RUNTIME_CHECK.md`
- `DASHBOARD_FULL_I18N_FIX_REPORT.md`
- `MVP_AUDIT_REPORT.md`
- `FORECAST_INSIGHTS_MVP_REPORT.md`
- `ALERTS_CENTER_MVP_REPORT.md`

## Phase 1 Foundation

Phase 1 established the local Docker-based project foundation:

- PostgreSQL/TimescaleDB, Redis, Qdrant, MQTT, API, AI, Web, and Nginx services.
- Health checks for core infrastructure containers.
- Minimal FastAPI API and AI services with health endpoints.
- Minimal Next.js frontend served from the `web` container.
- Nginx as a local reverse proxy.

Key fixes included stabilizing MQTT authentication, replacing the Qdrant health check, making the frontend listen on `0.0.0.0`, and ensuring the full local stack could run with Docker Compose.

## Pilot MVP Status And Module Planning

The pilot MVP status report estimated the project at roughly 74% readiness before the later UI modules were completed. At that time the system already had:

- Core Docker infrastructure.
- Backend foundation with FastAPI, repositories, schemas, and system status endpoints.
- Forecast data models and accuracy aggregation.
- MQTT telemetry ingestion with rejected telemetry persistence.
- Forecast Accuracy Lab, Forecast Providers, Telemetry, and partial Data Quality/System Health coverage.

The next-module analysis identified Data Quality & Rejected Telemetry as the highest-value next module, followed by System Health / Monitoring.

## Telemetry MVP

Telemetry MVP added backend and frontend coverage for accepted telemetry:

- Latest telemetry lookup by asset/plant.
- Historical telemetry lookup by asset/plant and period.
- Telemetry summary for Dashboard use.
- Telemetry Dashboard section with KPI cards, freshness status, signal panel, and SVG power history chart.
- EN/RU/KZ localization for Telemetry UI.

Known limitations included first-plant selection only, no realtime polling/WebSocket refresh, no accepted raw telemetry audit trail, and no device/inverter-level model.

## Data Quality And Rejected Telemetry MVP

Data Quality replaced the Rejected Telemetry placeholder with a real Dashboard section using existing backend APIs:

- KPI cards for rejected records, rejection rate, top reason, and affected assets.
- Period, asset, and rejection reason filters.
- Top rejection reasons panel.
- Data Quality status states: Clean, Watch, Attention.
- Latest rejected records table with source, topic, plant, reason, resolution status, and error detail.
- EN/RU/KZ localization.

The implementation used existing rejected telemetry endpoints and telemetry summary counts. Remaining risks included client-side reason filtering for summary totals and dependence on accepted telemetry summary availability.

## Data Quality Proxy Check

The Data Quality proxy investigation found that Dockerized Next.js rewrites were targeting `http://localhost:8000`, which points back to the `web` container rather than the API container.

The fix was to set:

```text
NEXT_DEV_BACKEND_URL=http://api:8000
```

for the Docker `web` service. After restart, same-origin proxy requests through `localhost:3000/api/...` returned `200`.

## System Health MVP

System Health / Monitoring replaced the System Status placeholder with a real Dashboard section using existing API data:

- Overall platform status.
- API, database, Redis, Qdrant, MQTT, telemetry freshness, and last telemetry KPIs.
- Service Health Summary.
- Operational Signals panel.
- Service Status table.
- EN/RU/KZ localization.

Backend limitations were kept honest: MQTT broker/subscriber readiness, web/nginx status, historical uptime, and incident history were not exposed by backend APIs and were shown as unknown or unavailable rather than mocked.

## System Health And Data Quality UI Fixes

Two UI issues were addressed:

- Data Quality KPI text overflow in RU/KZ was fixed by allowing `MetricCard` to use a compact `metric-value-text` style for textual KPI values such as top rejection reason.
- System Status placeholder concerns were traced to stale frontend runtime/bundle behavior rather than a missing render path.

The root cause for the Data Quality issue was that long translated text was using numeric KPI typography. The fix reduced text KPI font size, allowed wrapping, and kept numeric KPI styling unchanged.

## System Health Localization Checks

System Health machine values were mapped to localized labels in the frontend:

- Status values such as `healthy`, `warning`, `critical`, `unknown`, and `offline`.
- Environment values such as `development`, `production`, and `staging`.
- Dependency table statuses through localized monitoring badges.

A runtime check after commit `44aaf2f` confirmed that stale `web` runtime was the cause of old English labels still appearing in the UI. Restarting the `web` service refreshed the bundle and RU/KZ status labels rendered correctly.

## Full Dashboard i18n Audit

A full i18n audit covered seven Dashboard sections:

1. Overview
2. Solar Plants
3. Forecast Accuracy Lab
4. Forecast Providers
5. Telemetry
6. Rejected Telemetry
7. System Status

The audit added or extended frontend mapping helpers for machine values, statuses, telemetry source/quality, provider display names/types, environment labels, rejection reasons, dates, numbers, percentages, and units.

Fields intentionally not translated included asset IDs, UUIDs, provider codes, raw MQTT topics, service names, timezone identifiers, and real plant names.

## MVP Audit

The MVP audit verified UI, API usage, i18n, empty states, and error states for the core Dashboard modules.

At the time of audit:

- Overview, Forecast Accuracy Lab, Telemetry, Rejected Telemetry, and System Health were considered MVP-ready.
- Solar Plants and Forecast Providers were mostly ready but still needed stronger explicit API-unavailable states.
- All runtime endpoints checked through the frontend proxy returned `200`.
- Browser-level screenshots remained limited by lack of a headless browser in the local environment.

## Forecast Insights MVP

Forecast Insights added a frontend-only section to evaluate progress from the `14%` baseline MAPE toward the `<10%` pilot target.

Implemented:

- Current MAPE, baseline, target, improvement, best provider, and Days Below Target KPI cards.
- Honest empty state for MAPE trend because existing APIs return aggregate summary metrics, not daily bucket series.
- Provider comparison using Accuracy Lab ranking.
- Insights summary for current MAPE vs baseline/target, best provider, bias, and data coverage.
- EN/RU/KZ localization.

No backend endpoints, database tables, API contracts, or business logic were changed.

## Alerts Center MVP

Alerts Center added a frontend-only read-only section that computes operator alerts from current API responses.

Computed alert rules include:

- Telemetry stale/offline and data gaps.
- Rejected telemetry exists and critical top rejection reasons.
- MAPE above `<10%` target or at/above `14%` baseline.
- Worst provider MAPE above target.
- Strong forecast bias.
- No forecast runs or failed/pending forecast runs.
- System dependency critical/offline/down/failed/error.
- Solar plant missing or inactive.

The UI added:

- Active, critical, warning, forecast, data quality, system, and highest-severity KPI cards.
- Operator Priority card with recommended actions.
- Current signal summary.
- Alerts Table with severity, category, alert type, entity, signal value, computed open status, source API, and recommended action.
- MVP limits note explaining that persistence, acknowledgement, snooze, history, and rules engine are future work.

## Alerts Center UI Polish

Alerts Table UX was polished after MVP implementation:

- Horizontal scrolling was removed.
- Forced table row `min-width` was removed.
- Long text wraps across multiple lines.
- Status and Source API columns were made more compact.
- Entity, Signal Value, Source API, and Recommended Action use wrapping and word breaking.
- Responsive fallback was added:
  - Two-column layout below desktop width.
  - One-column layout on small screens.

## Current Cleanup Outcome

The root-level technical reports listed in "Source Reports Consolidated" were merged into this single history document and can be removed from the repository root. Long-lived project documents remain in place.
