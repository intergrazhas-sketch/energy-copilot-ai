# Energy Copilot AI

Energy Copilot AI is an enterprise SaaS platform for energy asset management, telemetry monitoring, and forecast intelligence.

The platform helps operators, engineers, managers, and executives understand solar asset status, forecast quality, provider performance, and telemetry reliability through a simple trilingual dashboard.

## Product Goal

The product goal is to prove measurable forecast error reduction and financial value from imbalance reduction for renewable energy assets.

The pilot focus is Varvarinskaya Solar Power Plant in Kazakhstan, where the current forecast error baseline is about 14%, the target is below 10%, and an excellent result is below 5%.

## Technology Stack

- Backend: FastAPI, Python, SQLAlchemy, Alembic
- Database: PostgreSQL / TimescaleDB
- Messaging: MQTT
- Cache: Redis
- Vector store: Qdrant
- Frontend: Next.js, React, TypeScript
- Internationalization: next-intl
- Infrastructure: Docker Compose, Nginx

## Current MVP Status

The project has completed the first Dashboard MVP layer and several backend modules needed for forecast intelligence, telemetry ingestion, provider ranking, accuracy analysis, and rejected telemetry tracking.

## Implemented Modules

- Overview
- Solar Plants
- Forecast Accuracy Lab
- Forecast Providers

## Next Module

- Telemetry MVP

## Project Documents

- [PLAN.md](PLAN.md)
- [ROADMAP.md](ROADMAP.md)
