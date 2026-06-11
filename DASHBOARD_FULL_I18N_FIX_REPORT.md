# Dashboard Full i18n Fix Report

## Scope

Performed a full frontend/i18n audit and fix across all 7 Energy Copilot Dashboard sections:

1. Overview
2. Solar Plants
3. Forecast Accuracy Lab
4. Forecast Providers
5. Telemetry
6. Rejected Telemetry
7. System Status

Backend, API contracts, and business logic were not changed.

## Raw User-Facing Values Found

The audit found these user-facing values still leaking as raw English or machine values in RU/KZ contexts:

- Overview: raw system status value such as `ok`; provider `provider_type` such as `manual` / `mock`; raw rejection reason labels from `normalizeReason(...)`.
- Solar Plants: date values formatted with fixed `en-US` locale.
- Forecast Accuracy Lab: generic demo provider names such as `Mock Forecast` / `Manual Forecast` rendered directly from API ranking data.
- Forecast Providers: generic demo provider names and provider types rendered directly from API registry/ranking data.
- Telemetry: `source` and `quality` values such as `mqtt`, `manual`, `measured`, `accepted`; timestamps formatted with fixed `en-US` locale.
- Rejected Telemetry: raw source labels, normalized English reason labels, and timestamps formatted with fixed `en-US` locale.
- System Status: dependency summary counts and timestamps were not locale-aware; prior System Status localization was kept and extended.

## Mapping Helpers Added or Extended

Updated frontend helpers in `apps/web/pages/index.tsx`:

- `normalizeMachineValue(...)`
- `translateMachineValue(...)`
- `translateStatusLabel(...)`
- `translateTelemetrySource(...)`
- `translateTelemetryQuality(...)`
- `translateProviderName(...)`
- `translateProviderType(...)`
- `translateMonitoringStatusValue(...)`
- Extended `translateEnvironment(...)`
- Extended date/number helpers with active locale support:
  - `formatNumber(...)`
  - `formatPercent(...)`
  - `formatTranslatedUnit(...)`
  - `formatCapacityMw(...)`
  - `formatPlantLocation(...)`
  - `formatDate(...)`
  - `formatDateTime(...)`

## Translation Updates

Updated EN/RU/KZ messages for:

- Common statuses: `ok`, `active`, `inactive`, `open`, `fixed`, `ignored`, `healthy`, `warning`, `critical`, `offline`, `fresh`, `stale`, `error`, `failed`, `down`, `pending`, `unknown`.
- Telemetry freshness, source, and quality labels.
- Data Quality rejection reasons and raw reason code captions.
- Forecast provider demo display names and provider type labels.
- Environment labels: `development`, `production`, `staging`.
- Period labels and related helper copy.
- RU/KZ helper text that previously mixed English words such as `registry`, `backend status`, `live status`, and `timestamps`.

## Files Changed

- `apps/web/pages/index.tsx`
- `apps/web/messages/en.json`
- `apps/web/messages/ru.json`
- `apps/web/messages/kz.json`
- `DASHBOARD_FULL_I18N_FIX_REPORT.md`

Existing untracked report from the previous runtime check remains uncommitted:

- `SYSTEM_HEALTH_LOCALIZATION_RUNTIME_CHECK.md`

## Checks Passed

Build:

- `npm run build` completed successfully.
- Next.js compiled successfully.
- Static pages generated successfully.

Local runtime:

- `http://localhost:3000/` returned `200`.
- `ec_web` was restarted because the dev runtime initially served a stale bundle.
- After restart, the served browser bundle contained the expected EN/RU/KZ labels for provider names, telemetry quality/source, rejection reasons, freshness, and environments.

API proxy endpoints:

- `GET /health` -> `200`
- `GET /api/v1/system/status` -> `200`
- `GET /api/v1/solar-plants` -> `200`
- `GET /api/v1/forecast-providers` -> `200`
- `GET /api/v1/forecast-runs` -> `200`
- `GET /api/v1/accuracy-lab/summary?...` -> `200`
- `GET /api/v1/accuracy-lab/providers/ranking?...` -> `200`
- `GET /api/v1/telemetry/latest?asset_id=...` -> `200`
- `GET /api/v1/telemetry/history?asset_id=...&from=...&to=...` -> `200`
- `GET /api/v1/telemetry/summary?asset_id=...&from=...&to=...` -> `200`
- `GET /api/v1/telemetry/rejected/summary` -> `200`
- `GET /api/v1/telemetry/rejected` -> `200`

Logical EN/RU/KZ checks:

- Status labels are localized.
- Freshness labels are localized.
- Telemetry source and quality labels are localized.
- Rejection reasons are localized.
- Period labels are localized.
- Demo provider names and provider types are localized.
- Environment labels are localized.
- Date/time formatting now uses the active locale.

## Intentionally Not Translated

These fields remain raw by design because they are business identifiers, technical identifiers, or diagnostic values:

- Asset IDs and UUIDs.
- Provider codes.
- Raw MQTT topics.
- Real solar plant names returned by API.
- Timezone identifiers.
- Dependency/service names such as `API`, `Redis`, `Qdrant`, `MQTT`.
- Technical product names such as `SCADA`, `Huawei SmartACU2000D`, `PostgreSQL`, `TimescaleDB`.
- Raw reason codes are shown only under a localized caption such as `Code: ...` / `Код: ...` / `Код: ...` for diagnostics.

## Conclusion

A) Можно нажимать Keep All.
