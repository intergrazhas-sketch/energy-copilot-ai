# Pilot MVP Status

## Summary

Energy Copilot AI is past the basic Dashboard MVP stage and now has working backend and frontend coverage for the main pilot workflow: assets, forecast accuracy, provider ranking, accepted telemetry, and rejected telemetry tracking.

The current pilot MVP is approximately **74% ready**.

This estimate is based on 8 pilot modules:

1. Foundation Infrastructure
2. Dashboard MVP / Overview
3. Solar Plants Registry
4. Forecast Accuracy Lab
5. Forecast Providers
6. Telemetry Dashboard
7. Data Quality & Rejected Telemetry
8. System Health / Operations Status

## Module Readiness

| Module | Readiness | Status |
|---|---:|---|
| Foundation Infrastructure | 90% | Mostly complete |
| Dashboard MVP / Overview | 90% | Mostly complete |
| Solar Plants Registry | 70% | Partially complete |
| Forecast Accuracy Lab | 85% | Mostly complete |
| Forecast Providers | 80% | Mostly complete |
| Telemetry Dashboard | 75% | Partially complete |
| Data Quality & Rejected Telemetry | 55% | Partially complete |
| System Health / Operations Status | 45% | Partially complete |

Overall readiness: **74%**.

## Completed

- Local Docker stack exists for PostgreSQL/TimescaleDB, Redis, Qdrant, MQTT, API, AI, Web, and Nginx.
- Backend foundation exists with FastAPI, `/health`, `/api/v1/system/status`, SQLAlchemy, Alembic, repositories, services, and schemas.
- Forecast MVP data model exists:
  - solar plants
  - forecast providers
  - forecast runs
  - forecast values
  - actual generation
  - forecast accuracy
  - accuracy aggregates
- MQTT ingestion exists and writes valid telemetry into `actual_generation`.
- Bad telemetry is written into `rejected_telemetry`.
- Provider ranking exists through Accuracy Lab provider ranking endpoints.
- Forecast Accuracy Lab backend and frontend are implemented.
- Forecast Providers frontend is implemented with registry, ranking, KPIs, and comparison.
- Telemetry Backend MVP is implemented:
  - latest telemetry
  - telemetry history
  - telemetry summary
- Telemetry Frontend MVP is implemented:
  - KPI cards
  - freshness status
  - power history chart
  - signal status panel
- Trilingual UI exists for EN / RU / KZ.
- Project documentation exists:
  - `PLAN.md`
  - `ROADMAP.md`
  - `README.md`
  - `TELEMETRY_MVP_REPORT.md`

## Partially Completed

### Solar Plants Registry

Already partially implemented inside the current Dashboard.

Implemented:

- Solar Plants sidebar section.
- KPI cards for total plants, active plants, capacity, and telemetry interval target.
- Table of plants using `GET /api/v1/solar-plants`.
- Pilot context card for Varvarinskaya SPP.
- EN / RU / KZ translations.

Still missing:

- Asset selection shared across Dashboard modules.
- Create/edit/onboarding UI.
- Dedicated pilot asset details page.
- Plant-level telemetry and forecast drill-down.

Estimated readiness: **70%**.

### Data Quality & Rejected Telemetry

Already partially implemented.

Implemented:

- `rejected_telemetry` database table.
- MQTT validation and rejected message persistence.
- Rejected telemetry backend API:
  - summary
  - list
  - detail
  - resolution status update
- Overview panel showing rejected telemetry summary.
- EN / RU / KZ texts for current summary states.

Still missing:

- Full Rejected Telemetry UI page.
- Filters by plant, reason, period, and resolution status.
- Detail drawer/page with raw payload.
- Resolution notes, owner, and reprocess workflow.
- Data quality dashboard for accepted telemetry gaps and freshness.

Estimated readiness: **55%**.

### System Health

Already partially implemented.

Implemented:

- `/health` endpoint.
- `/api/v1/system/status` endpoint.
- Postgres, Redis, and Qdrant readiness checks.
- Overview System Health panel.
- Header status badge.

Still missing:

- Full System Status UI page.
- MQTT broker/subscriber readiness check.
- API/container status details.
- Degraded-state explanation for non-technical users.
- Historical uptime or incident status.

Estimated readiness: **45%**.

### Telemetry Dashboard

Implemented as a first MVP.

Implemented:

- Telemetry sidebar section.
- Backend endpoints for latest/history/summary.
- Frontend cards for current power, energy today, average power, max power, last telemetry time, freshness status, telemetry points count, possible data gap, and estimated revenue when available.
- Power history chart using real backend data.
- EN / RU / KZ translations.

Still missing:

- Asset selector.
- Realtime refresh or polling.
- Tooltip/zoom on chart.
- Device/inverter-level telemetry.
- Raw accepted telemetry audit trail.

Estimated readiness: **75%**.

## Still To Do

- Add full Rejected Telemetry page.
- Add full System Status page.
- Add asset selection for Telemetry and cross-module filtering.
- Add plant-specific provider comparison UI.
- Add real forecast provider integration beyond manual/mock.
- Add backend/frontend tests.
- Add production hardening:
  - auth/RBAC
  - secrets hygiene
  - backup/restore
  - monitoring/logging
  - retention/compression policies for TimescaleDB

## Recommended Next Module

The logical next module is **Data Quality & Rejected Telemetry full page**.

Reason:

- Backend already exists.
- Overview already shows a summary.
- It directly supports pilot onboarding because real telemetry will produce invalid topics, invalid timestamps, capacity violations, stale data, and malformed payloads.
- Operators and engineers need a visible way to understand why telemetry was rejected before trusting forecast accuracy results.

After that, the next module should be **System Health / Operations Status**.

## Pilot MVP Readiness Conclusion

The pilot MVP is functionally beyond halfway and now has the core proof loop:

1. Solar asset exists.
2. Forecast providers exist.
3. Actual telemetry can be ingested.
4. Bad telemetry can be rejected and tracked.
5. Forecast accuracy can be calculated and ranked.
6. Dashboard can show Overview, Solar Plants, Accuracy Lab, Providers, and Telemetry.

Current overall readiness: **74%**.

The remaining work is mostly about operational visibility, quality review, asset selection, and production-grade hardening.
