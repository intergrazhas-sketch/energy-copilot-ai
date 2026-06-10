# Next Module Analysis

## Context

This analysis uses the current project state described in `PILOT_MVP_STATUS.md` and the implemented backend/frontend modules in the repository.

The current pilot MVP readiness is approximately **74%**. Three remaining operational modules are partially complete and need prioritization:

1. Solar Plants Registry
2. Data Quality & Rejected Telemetry
3. System Health / Monitoring

## 1. Solar Plants Registry

### What Is Already Implemented

- Solar Plants section exists in the Dashboard sidebar.
- Frontend uses `GET /api/v1/solar-plants`.
- KPI cards are implemented:
  - total plants
  - active plants
  - total capacity in kW / MW
  - telemetry interval target
- Plant list/table is implemented with:
  - name
  - capacity
  - status
  - timezone
  - location from latitude/longitude
  - created date
- Static pilot context card exists for Varvarinskaya SPP:
  - 22.6 MW / 22,600 kW
  - Kostanay region, Kazakhstan
  - Huawei SmartACU2000D
  - 68 Huawei inverters
  - telemetry interval 15 minutes
  - forecast baseline / target / excellent thresholds
- Backend already has:
  - `solar_plants` table
  - `SolarPlant` model
  - `SolarPlantCreate` / `SolarPlantRead` schemas
  - `POST /api/v1/solar-plants`
  - `GET /api/v1/solar-plants`
  - `GET /api/v1/solar-plants/{plant_id}`
- EN / RU / KZ texts exist for the current Solar Plants UI.

### What Is Missing

- Shared asset selector across Dashboard modules.
- Dedicated plant detail page.
- Plant-level drill-down for telemetry, forecasts, rejected telemetry, and provider comparison.
- Operator-facing onboarding flow for the pilot asset.
- Editable plant metadata UI.
- Clear distinction between registry data from backend and static pilot context data.
- Storage for pilot-specific technical metadata:
  - SCADA model
  - inverter count
  - telemetry interval target
  - forecast baseline and target thresholds
  - customer interest tags such as PV forecasting and BESS

### Readiness

**70% ready.**

The module is already useful as a read-only registry and pilot context screen, but it is not yet the central asset context for all other modules.

### Required For The Pilot SPP

- One reliable pilot asset record for Varvarinskaya SPP with correct capacity, timezone, status, and location.
- Asset selector or fixed selected pilot asset used consistently by:
  - Telemetry Dashboard
  - Forecast Accuracy Lab
  - Forecast Providers
  - Rejected Telemetry
  - System Status
- Plant detail view or equivalent panel showing all pilot-critical metadata.
- Plant-level navigation into telemetry, quality, and forecast accuracy.

### Can Be Deferred To Phase 2

- Full create/edit/admin UX.
- Multi-asset portfolio management.
- Bulk import of plants.
- Advanced hierarchy: plant / inverter / string / meter.
- Asset documents, contracts, owner metadata, and maintenance metadata.
- Complex map view or geospatial visualization.

## 2. Data Quality & Rejected Telemetry

### What Is Already Implemented

- `rejected_telemetry` database table exists.
- Backend model exists for rejected telemetry records with:
  - source
  - topic
  - plant ID
  - reason
  - error message
  - raw payload text
  - raw payload JSON
  - received timestamp
  - resolved timestamp
  - resolution status
  - metadata
- MQTT ingestion can reject bad telemetry and persist rejection records.
- Backend schemas define rejection reasons:
  - invalid topic
  - invalid plant ID
  - plant not found
  - invalid JSON
  - invalid timestamp
  - future timestamp
  - stale timestamp
  - negative power
  - negative energy
  - power exceeds capacity
  - database error
  - unknown error
- Backend APIs exist:
  - `GET /api/v1/telemetry/rejected/summary`
  - `GET /api/v1/telemetry/rejected`
  - `GET /api/v1/telemetry/rejected/{rejected_id}`
  - `PATCH /api/v1/telemetry/rejected/{rejected_id}/resolution`
- Repository supports filtering by:
  - plant
  - reason
  - period
  - resolution status
  - limit / offset
- Overview already shows rejected telemetry summary and top reasons.
- Navigation already contains Rejected Telemetry.
- EN / RU / KZ texts exist for current summary and empty states.

### What Is Missing

- Full Rejected Telemetry UI page.
- Table/list of rejected messages.
- Filters:
  - plant
  - reason
  - period
  - resolution status
- Detail drawer or page with raw payload and error message.
- UI action for changing resolution status.
- Resolution notes or ownership fields.
- Reprocess workflow for fixed telemetry.
- Accepted telemetry data quality dashboard:
  - missing intervals
  - stale data
  - freshness by asset
  - expected vs received telemetry points
- Operator-friendly explanation of rejection reasons.
- Link from rejected records back to the affected solar plant.

### Readiness

**55% ready.**

The backend foundation is strong, but the module is not yet usable by operators because the dedicated UI is still a placeholder.

### Required For The Pilot SPP

- Rejected Telemetry page with real backend data.
- Filter by Varvarinskaya SPP.
- Open/review/fixed/ignored workflow visible in UI.
- Raw payload visibility for engineers.
- Clear reason labels in EN / RU / KZ.
- Summary of open quality issues during pilot onboarding.
- Freshness and gap context connected to accepted telemetry, so the team can explain whether forecast accuracy is based on reliable actuals.

### Can Be Deferred To Phase 2

- Automated reprocessing after a fix.
- Assignment to owners and SLA tracking.
- Audit log for every resolution status change.
- Alerting and notifications.
- Advanced anomaly detection beyond validation rules.
- Export to CSV or external incident systems.
- Long-term quality trend analytics.

## 3. System Health / Monitoring

### What Is Already Implemented

- `/health` endpoint exists.
- `/api/v1/system/status` endpoint exists.
- Backend readiness checks exist for:
  - PostgreSQL
  - Redis
  - Qdrant
- Readiness response includes:
  - overall status
  - service name
  - version
  - environment
  - dependencies
  - dependency latency
  - dependency error message when available
- Overview shows System Health panel.
- Header shows current status badge.
- Navigation already contains System Status.
- EN / RU / KZ texts exist for current Overview system states.

### What Is Missing

- Full System Status UI page.
- MQTT broker readiness check.
- MQTT subscriber/ingestion status.
- API container/runtime status details.
- Web container status.
- Nginx status.
- Database migration status.
- TimescaleDB/hypertable status.
- Disk/storage/retention visibility.
- User-friendly degraded-state explanation.
- Incident or uptime history.
- Operational checklist for local/server deployment.

### Readiness

**45% ready.**

The module provides basic dependency readiness, but it is not yet a complete pilot operations screen.

### Required For The Pilot SPP

- Dedicated System Status page showing all pilot-critical services:
  - API
  - Web
  - PostgreSQL / TimescaleDB
  - Redis
  - MQTT broker
  - MQTT subscriber
- Clear status meaning for non-technical users:
  - healthy
  - degraded
  - unavailable
- Last checked time and dependency latency.
- Explanation of whether telemetry ingestion and dashboard data are trustworthy right now.
- Basic operational troubleshooting hints.

### Can Be Deferred To Phase 2

- Historical uptime charts.
- Incident timeline.
- Alert manager integration.
- Prometheus/Grafana-grade observability.
- Container-level resource monitoring.
- Distributed tracing.
- Production SLO/SLA reporting.

## Recommendation

The next module with the highest value for completing the pilot MVP is **Data Quality & Rejected Telemetry**.

Reason:

- The backend is already implemented and tested enough to support a real UI quickly.
- The current Dashboard already shows only a summary, but operators still cannot inspect individual rejected messages.
- During pilot onboarding, real telemetry will likely produce invalid payloads, missing fields, wrong timestamps, stale timestamps, topic mistakes, and capacity violations.
- Forecast Accuracy Lab depends on trusted actual telemetry. If bad telemetry is hidden, the pilot team cannot explain whether forecast error comes from provider quality or data quality.
- This module directly improves trust in Telemetry Dashboard, Accuracy Lab, and the commercial proof of value.

Recommended next implementation:

**Rejected Telemetry UI MVP v1**

Minimum scope:

- Use existing endpoints only.
- Add real content for the Rejected Telemetry sidebar section.
- Show KPI cards:
  - open rejected messages
  - total rejected messages in selected period
  - top rejection reason
  - affected plants count
- Add table:
  - received time
  - plant
  - reason
  - source
  - topic
  - resolution status
- Add filters:
  - period
  - reason
  - resolution status
- Add detail view or expandable row with error message and raw payload.
- Preserve EN / RU / KZ.
- Do not add new backend endpoints for MVP v1.

After that, the next highest-value module should be **System Health / Monitoring**, especially MQTT broker and subscriber readiness.
