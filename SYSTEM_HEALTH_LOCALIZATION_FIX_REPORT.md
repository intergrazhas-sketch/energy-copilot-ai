# System Health Localization Fix Report

## Summary

Fixed frontend-only localization for System Status machine values in the Dashboard MVP.

The backend and API contract were not changed. Raw machine values from the API are still consumed by the frontend, but user-visible labels are now mapped to localized EN/RU/KZ strings before rendering.

## Root Cause

System Health card titles and table labels were already translated, but several values were rendered either through translation keys that still contained English labels in RU/KZ files or directly from backend machine values.

Affected values:

- `healthy`
- `warning`
- `critical`
- `unknown`
- `offline`
- `development`
- `production`

The `development` / `production` value was rendered directly from `system.environment` / `health.environment`, so it bypassed i18n entirely.

## Fix

Implemented frontend mapping for environment machine values:

- `development` -> localized label
- `production` -> localized label
- `staging` -> localized label

Updated EN/RU/KZ message files for:

- System Health statuses: `healthy`, `warning`, `critical`, `unknown`
- Telemetry freshness statuses used in System Status: `fresh`, `stale`, `offline`
- Environment values: `development`, `production`, `staging`
- Related helper text that previously exposed machine words in RU/KZ

Dependency table statuses already render through `MonitoringStatusBadge`, which uses `systemHealth.status.*`. After updating those keys, API, Database, Redis, Qdrant, and MQTT status values are localized as well.

## Changed Files

- `apps/web/pages/index.tsx`
- `apps/web/messages/en.json`
- `apps/web/messages/ru.json`
- `apps/web/messages/kz.json`
- `SYSTEM_HEALTH_LOCALIZATION_FIX_REPORT.md`

## Local Verification

Build:

- `npm run build` completed successfully.
- Next.js compiled successfully.
- Static pages generated successfully.

Runtime checks:

- `http://localhost:3000/` returned `200`.
- `http://localhost:3000/api/v1/system/status` returned `200`.

Localization mapping check:

- EN: `Healthy`, `Warning`, `Critical`, `Unknown`, `Offline`, `Development`, `Production`
- RU: `Исправно`, `Предупреждение`, `Критично`, `Неизвестно`, `Нет связи`, `Разработка`, `Продакшн`
- KZ: `Қалыпты`, `Ескерту`, `Критикалық`, `Белгісіз`, `Байланыс жоқ`, `Әзірлеу`, `Продакшн`

## Notes

- No backend files were changed.
- No API endpoints were changed.
- No commit was created.
- No push was performed.
