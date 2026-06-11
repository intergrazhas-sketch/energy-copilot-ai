# MVP Audit Report

## Scope

Audit date: 2026-06-11

Audited Dashboard sections:

- Overview
- Solar Plants
- Forecast Accuracy Lab
- Forecast Providers
- Telemetry
- Rejected Telemetry
- System Health

This audit checks frontend UI coverage, API usage, RU / EN / KZ localization, empty states, and error states.

No code was changed for this audit. This report is a documentation artifact.

## Current Working Tree Note

At the start of the audit, the working tree already had uncommitted frontend UI changes:

- `apps/web/pages/index.tsx`
- `UI_FIX_SYSTEM_HEALTH_AND_DATA_QUALITY_REPORT.md`

This audit reflects the current local working tree, including those uncommitted UI fixes.

## Runtime API Verification

Checks were performed through the local frontend / Next proxy at `http://localhost:3000`.

| Check | Result |
|---|---:|
| `GET /` | 200 |
| `GET /health` | 200 |
| `GET /api/v1/system/status` | 200 |
| `GET /api/v1/solar-plants` | 200 |
| `GET /api/v1/forecast-providers` | 200 |
| `GET /api/v1/forecast-runs` | 200 |
| `GET /api/v1/accuracy-lab/summary?from=...&to=...&bucket=day` | 200 |
| `GET /api/v1/accuracy-lab/providers/ranking?from=...&to=...&bucket=day` | 200 |
| `GET /api/v1/telemetry/latest?asset_id=...` | 200 |
| `GET /api/v1/telemetry/history?asset_id=...&from=...&to=...&limit=96` | 200 |
| `GET /api/v1/telemetry/summary?asset_id=...&from=...&to=...` | 200 |
| `GET /api/v1/telemetry/rejected/summary` | 200 |
| `GET /api/v1/telemetry/rejected?limit=5` | 200 |

Telemetry asset used for runtime checks:

`60df5995-306b-40ea-a988-13405d036f1b`

## Summary Matrix

| Section | UI | API | RU | EN | KZ | Empty State | Error State | Status |
|---|---|---|---|---|---|---|---|---|
| Overview | Implemented | Implemented | Yes | Yes | Yes | Yes | Yes | Ready |
| Solar Plants | Implemented | Implemented | Yes | Yes | Yes | Yes | Partial | Mostly ready |
| Forecast Accuracy Lab | Implemented | Implemented | Yes | Yes | Yes | Yes | Yes | Ready |
| Forecast Providers | Implemented | Implemented | Yes | Yes | Yes | Yes | Partial | Mostly ready |
| Telemetry | Implemented | Implemented | Yes | Yes | Yes | Yes | Yes | Ready |
| Rejected Telemetry | Implemented | Implemented | Yes | Yes | Yes | Yes | Yes | Ready |
| System Health | Implemented | Implemented | Yes | Yes | Yes | Yes | Yes | Ready |

## 1. Overview

### UI

Implemented in `apps/web/pages/index.tsx` inside `DashboardOverview`.

The Overview renders:

- System Health KPI
- Solar Plants KPI
- Forecast Providers KPI
- Accuracy MAPE KPI
- Rejected Telemetry KPI
- System Health panel
- Solar Plants panel
- Accuracy Summary panel
- Forecast Providers panel
- Rejected Telemetry Summary panel

### API

Overview is populated from:

- `GET /health`
- `GET /api/v1/system/status`
- `GET /api/v1/solar-plants`
- `GET /api/v1/forecast-providers`
- `GET /api/v1/forecast-runs`
- `GET /api/v1/accuracy-lab/summary`
- `GET /api/v1/accuracy-lab/providers/ranking`
- `GET /api/v1/telemetry/rejected/summary`
- telemetry endpoints for the first available plant

Runtime API checks passed.

### Localization

RU / EN / KZ texts exist for:

- navigation
- header
- common loading/no data
- metrics
- overview panels
- system/solar/plants/providers/accuracy/rejected summary states

### Empty State

Implemented through section-level `EmptyState` blocks for system, solar plants, accuracy, providers, and rejected telemetry panels.

### Error State

Implemented as global API unavailable state when no live data loads:

- `errors.apiUnavailableTitle`
- `errors.apiUnavailableDetail`

### Audit Result

Ready for MVP.

## 2. Solar Plants

### UI

Implemented in `SolarPlantsSection`.

The page renders:

- Total plants
- Active plants
- Total capacity
- Telemetry interval target
- Solar plants table
- Static pilot context card for Varvarinskaya SPP

### API

Uses:

- `GET /api/v1/solar-plants`

Runtime API check passed with `200`.

### Localization

RU / EN / KZ texts exist under:

- `navigation.solarPlants`
- `solarPlants.*`

### Empty State

Implemented:

- loading state
- no plants state explaining pilot asset onboarding

### Error State

Partial.

There is no dedicated Solar Plants API error state inside `SolarPlantsSection`; failed plant fetch results in an empty list unless the whole dashboard has no data. This is acceptable for MVP but should be improved later with explicit unavailable messaging.

### Audit Result

Mostly ready.

Recommended improvement: add a dedicated "Solar Plants API unavailable" state.

## 3. Forecast Accuracy Lab

### UI

Implemented in `ForecastAccuracyLabSection`.

The page renders:

- Avg MAPE
- Avg RMSE
- Avg MAE
- Avg Bias
- Samples count
- Forecast runs count
- Pilot target card
- Provider ranking table

### API

Uses:

- `GET /api/v1/accuracy-lab/summary?from=...&to=...&bucket=day`
- `GET /api/v1/accuracy-lab/providers/ranking?from=...&to=...&bucket=day`

Runtime API checks passed with `200`.

### Localization

RU / EN / KZ texts exist under:

- `navigation.forecastAccuracyLab`
- `accuracy.*`
- `accuracyLab.*`

### Empty State

Implemented:

- no aggregates state
- empty provider ranking state
- loading states

### Error State

Implemented:

- Accuracy Lab API unavailable
- Provider ranking API unavailable

### Audit Result

Ready for MVP.

## 4. Forecast Providers

### UI

Implemented in `ForecastProvidersSection`.

The page renders:

- Total providers
- Active providers
- Total forecast runs
- Best provider by MAPE
- Providers table
- Provider comparison panel

### API

Uses:

- `GET /api/v1/forecast-providers`
- `GET /api/v1/accuracy-lab/providers/ranking`

Runtime API checks passed with `200`.

### Localization

RU / EN / KZ texts exist under:

- `navigation.forecastProviders`
- `providers.*`
- `forecastProviders.*`

### Empty State

Implemented:

- no providers
- no comparison
- loading states

### Error State

Partial.

If providers or ranking are unavailable, the UI falls back to empty/no comparison states. There is no dedicated "Forecast Providers API unavailable" state.

### Audit Result

Mostly ready.

Recommended improvement: add explicit unavailable states for provider registry and ranking fetch failures.

## 5. Telemetry

### UI

Implemented in `TelemetrySection`.

The page renders:

- Current Power
- Energy Today
- Average Power
- Max Power
- Last Telemetry Time
- Data Freshness Status
- Telemetry Points Count
- Possible Data Gap Minutes
- Estimated Revenue Today when provided by backend
- Power history chart
- Signal status panel

### API

Uses:

- `GET /api/v1/solar-plants` for first available asset
- `GET /api/v1/telemetry/latest?asset_id=...`
- `GET /api/v1/telemetry/history?asset_id=...&from=...&to=...`
- `GET /api/v1/telemetry/summary?asset_id=...&from=...&to=...`

Runtime API checks passed with `200`.

### Localization

RU / EN / KZ texts exist under:

- `navigation.telemetry`
- `telemetry.*`

### Empty State

Implemented:

- no asset available
- no telemetry history
- loading history/status

### Error State

Implemented:

- telemetry summary unavailable for selected asset

### Audit Result

Ready for MVP.

## 6. Rejected Telemetry

### UI

Implemented in `DataQualitySection`.

The page renders:

- Total Rejected Records
- Rejection Rate
- Top Rejection Reason
- Affected Assets
- Period / Asset / Rejection Reason filters
- Top rejection reasons panel
- Quality status panel
- Latest rejected records table

Recent local UI fix:

- Text KPI value now uses `metric-value-text`.
- Data Quality KPI grid uses four desktop columns.

### API

Uses:

- `GET /api/v1/telemetry/rejected/summary`
- `GET /api/v1/telemetry/rejected`
- `GET /api/v1/telemetry/summary` for accepted telemetry counts
- `GET /api/v1/solar-plants` for asset filter options

Runtime API checks passed with `200`.

### Localization

RU / EN / KZ texts exist under:

- `navigation.rejectedTelemetry`
- `dataQuality.*`
- `rejectedTelemetry.*`

### Empty State

Implemented:

- no rejection reasons
- no rejected records
- clean telemetry state
- loading states for summary/status/records

### Error State

Implemented:

- rejected telemetry API unavailable when both summary and records fail

### Audit Result

Ready for MVP.

Note: latest UI fix is currently local and uncommitted at the time of audit.

## 7. System Health

### UI

Implemented in `SystemHealthSection`.

The current render path confirms:

- `activeSection === "system-status"` renders `SystemHealthSection`.
- `SectionPlaceholder` is only fallback for unknown sections.

The page renders:

- Overall Platform Status
- API Status
- Database Status
- Redis Status
- Qdrant Status
- MQTT Status
- Data Freshness
- Last Telemetry Update
- Service Health Summary
- Operational Signals
- Service Status table

### API

Uses:

- `GET /health`
- `GET /api/v1/system/status`
- `GET /api/v1/telemetry/summary`
- `GET /api/v1/telemetry/latest`
- `GET /api/v1/forecast-runs`

Runtime API checks passed with `200`.

### Localization

RU / EN / KZ texts exist under:

- `navigation.systemStatus`
- `system.*`
- `systemHealth.*`

### Empty State

Implemented:

- system health unavailable
- loading states for summary/signals/services

### Error State

Implemented:

- `/health` or `/api/v1/system/status` unavailable state

### Audit Result

Ready for MVP.

Known limitation: MQTT readiness is not exposed by backend, so UI correctly shows Unknown / Not available instead of mock data.

## Cross-Cutting Findings

### UI

All seven MVP sections have implemented frontend sections in the Dashboard.

### API

All required runtime endpoints checked during this audit returned `200` through the local frontend proxy.

### Localization

RU / EN / KZ message files contain translations for all seven MVP sections.

Some technical status words remain intentionally English-like in RU/KZ contexts, for example:

- Healthy
- Warning
- Critical
- Unknown
- Fresh / Stale / Offline

This is acceptable for MVP but can be localized more naturally later.

### Empty States

All sections have at least basic empty/loading states.

### Error States

Strongest explicit error states:

- Overview
- Forecast Accuracy Lab
- Telemetry
- Rejected Telemetry
- System Health

Partial error states:

- Solar Plants
- Forecast Providers

These currently fall back mostly to empty states when API data is unavailable.

## Final MVP Audit Conclusion

The Dashboard MVP is functionally complete across the requested sections:

- Overview
- Solar Plants
- Forecast Accuracy Lab
- Forecast Providers
- Telemetry
- Rejected Telemetry
- System Health

Overall UI/API/i18n readiness: **MVP-ready with minor UX hardening remaining**.

Recommended next improvements:

1. Add explicit API unavailable states for Solar Plants and Forecast Providers.
2. Add backend MQTT readiness so System Health can show real MQTT state.
3. Add browser-level visual regression screenshots once a headless browser is available in the environment.
