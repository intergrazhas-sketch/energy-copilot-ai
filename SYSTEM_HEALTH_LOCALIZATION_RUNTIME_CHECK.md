# System Health Localization Runtime Check

## Scope

Checked System Status localization after commit `44aaf2f` without changing application code, committing, or pushing.

## Runtime Refresh

`localhost:3000` was served by Docker service `ec_web`.

Initial runtime check showed that the container source files already had the new RU/KZ translations, but the served Next.js browser bundle did not yet contain all localized labels. This indicated a stale web runtime / stale dev bundle, not a source-code issue.

Action taken:

- Restarted only the `web` service with `docker compose restart web`.
- Waited for Next.js dev server to recompile and become ready.

## Checks

Runtime source inside `ec_web`:

- RU status labels present: `Критично`, `Исправно`, `Неизвестно`, `Нет связи`, `Разработка`.

Served browser bundle from `http://localhost:3000` after web restart:

- RU `Critical` -> `Критично`: passed.
- RU `Healthy` -> `Исправно`: passed.
- RU `Unknown` -> `Неизвестно`: passed.
- RU `Offline` -> `Нет связи`: passed.
- RU `development` -> `Разработка`: passed.
- KZ `Healthy` -> `Қалыпты`: passed.
- KZ `Unknown` -> `Белгісіз`: passed.
- KZ `Offline` -> `Байланыс жоқ`: passed.
- EN labels remain English: passed.

API/runtime values checked:

- `/api/v1/system/status` returns machine value `environment: development`.
- Dependency statuses return machine values such as `ok`.
- Frontend maps dependency statuses through `MonitoringStatusBadge` and `systemHealth.status.*`.
- Frontend maps environment through `translateEnvironment(...)`.

## Raw Status Output Review

No direct raw status rendering was found in the System Status cards or dependency table for the checked values.

Relevant rendering paths:

- KPI status values use `t("systemHealth.status.<status>")`.
- Dependency table status values use `MonitoringStatusBadge`.
- Data freshness uses `t("telemetry.freshness.<status>")`.
- Environment uses `translateEnvironment(...)`.

Unknown environment values intentionally fall back to the raw value because no localized key exists for them.

## Conclusion

A) Локализация реально работает в UI.
