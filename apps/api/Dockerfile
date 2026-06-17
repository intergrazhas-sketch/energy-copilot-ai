# ============================================================
#  Energy Copilot AI — Backend Dockerfile (FastAPI)
# ============================================================

FROM python:3.12-slim AS base

WORKDIR /app

# Системные зависимости
RUN apt-get update && apt-get install -y \
    curl \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# ── Development образ ────────────────────────────────────────
FROM base AS development

# Копируем зависимости
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# В dev режиме код монтируется как volume (см. docker-compose)
# Запускаем с hot-reload
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]

# ── Production образ ─────────────────────────────────────────
FROM base AS production

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Startup: try alembic (non-fatal), always ensure onboarding columns, then serve.
# `alembic upgrade` may fail on an out-of-sync prod DB, so it must not block boot.
CMD ["sh", "-c", "alembic upgrade head || echo '[startup] alembic upgrade skipped'; python -m app.db.ensure_schema; uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 4"]
