# Forecast Insights MVP Report

## Scope

Implemented a new frontend-only Dashboard section: **Forecast Insights**.

The MVP uses only existing APIs:

- `/api/v1/accuracy-lab/summary`
- `/api/v1/accuracy-lab/providers/ranking`
- `/api/v1/forecast-runs`
- `/api/v1/telemetry/summary`
- `/api/v1/solar-plants`

No backend endpoints, database tables, API contracts, or business logic were changed.

## What Was Added

- Added **Forecast Insights** to the left Dashboard navigation.
- Added KPI cards:
  - Current MAPE
  - Baseline MAPE: `14%`
  - Target MAPE: `<10%`
  - Improvement vs Baseline
  - Best Provider
  - Days Below Target
- Added a MAPE Trend panel with an honest empty state:
  - Trend is not drawn because the current summary API returns aggregate metrics, not daily bucket rows.
  - The UI shows: "Trend requires daily accuracy buckets".
- Added Provider Comparison using `/api/v1/accuracy-lab/providers/ranking`:
  - MAPE
  - RMSE
  - MAE
  - Bias
  - Samples
- Added Insights Summary:
  - Current MAPE vs `14%` baseline
  - Current MAPE vs `<10%` target
  - Best provider from ranking
  - Bias direction when available
  - Data coverage from forecast runs, accuracy samples, and telemetry summary

## Honest Data Handling

The MVP does not invent pilot business data.

- **Days Below Target** shows "Not enough data" because the existing APIs do not expose daily MAPE buckets as a list.
- **MAPE Trend** shows an empty state for the same reason.
- No monetary savings, tariffs, penalties, or financial impact are shown.
- Provider codes and real asset names remain unmodified technical/business identifiers.

## i18n

Added EN/RU/KZ translations for:

- Navigation label
- KPI labels and helper text
- Trend empty state
- Provider comparison table
- Insights Summary
- Loading and unavailable states

Technical metric names such as MAPE, RMSE, MAE, and Bias remain as domain abbreviations.

## Files Changed

- `apps/web/pages/index.tsx`
- `apps/web/messages/en.json`
- `apps/web/messages/ru.json`
- `apps/web/messages/kz.json`
- `FORECAST_INSIGHTS_MVP_REPORT.md`

## Verification

Build:

- `npm run build` completed successfully.
- Next.js compiled successfully and generated static pages.

Runtime:

- `http://localhost:3000` returned `200` after restarting the `web` Docker service.

API proxy checks with Dashboard-compatible query parameters:

- `/api/v1/accuracy-lab/summary` returned `200`
- `/api/v1/accuracy-lab/providers/ranking` returned `200`
- `/api/v1/forecast-runs` returned `200`
- `/api/v1/telemetry/summary` returned `200`
- `/api/v1/solar-plants` returned `200`

i18n checks:

- EN strings for Forecast Insights are present.
- RU strings for Forecast Insights are present.
- KZ strings for Forecast Insights are present.

Visual/runtime note:

- The live page and API runtime were verified locally.
- A full browser click-through automation was not available in this environment because no browser test runner is installed and no system browser command was available. The implementation was still checked through build, diagnostics, live root status, proxy API responses, and localized message presence.

## Final Status

Forecast Insights MVP is implemented and ready for manual review in the running Dashboard.

Commit was not created.
Push was not performed.
