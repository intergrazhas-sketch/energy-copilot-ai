# Production Deploy Energy Copilot AI

Эта инструкция готовит Energy Copilot AI как отдельный проект на сервере, где уже может работать PetroAI.

Не запускайте на сервере локальный `docker-compose.yml`. В нем есть development-порты и fixed `container_name`, которые могут конфликтовать с PetroAI.

## Структура На Сервере

Рекомендуемая папка:

```bash
/opt/energy-copilot-ai
```

PetroAI должен оставаться в своей папке, со своей базой, Docker project, network и volumes.

## Клонирование И Env

```bash
cd /opt
git clone https://github.com/intergrazhas-sketch/energy-copilot-ai.git energy-copilot-ai
cd /opt/energy-copilot-ai
cp .env.prod.example .env.prod
```

В `.env.prod` нужно заполнить реальные значения:

- `POSTGRES_PASSWORD`
- `REDIS_PASSWORD`
- `QDRANT_API_KEY`
- `DATABASE_URL`
- `REDIS_URL`
- `SECRET_KEY`
- `CORS_ORIGINS`

Используйте отдельные имя базы и пользователя, например:

```env
POSTGRES_DB=energy_copilot_prod
POSTGRES_USER=energy_copilot_user
```

Не используйте базу, пользователей, пароли, network или volumes от PetroAI.

## Запуск Backend Stack

Проверить compose без запуска контейнеров:

```bash
docker compose --env-file .env.prod -f docker-compose.prod.yml config
```

Запустить production backend stack:

```bash
docker compose --env-file .env.prod -f docker-compose.prod.yml up -d --build
```

В production compose входят:

- `api` - FastAPI backend
- `postgres` - TimescaleDB/PostgreSQL
- `redis` - нужен текущему backend для readiness checks
- `qdrant` - нужен текущему backend для readiness checks

В production compose не входят:

- frontend container
- MQTT broker
- AI service

API доступен только внутри Docker network на порту `8000`.

## Миграции Базы

Миграции не запускаются автоматически при старте API.

```bash
docker compose --env-file .env.prod -f docker-compose.prod.yml exec api alembic upgrade head
```

Эта команда применяет схемы для forecast, actual generation, rejected telemetry, accuracy и Timescale hypertable.

## Проверка Health

Изнутри API container:

```bash
docker compose --env-file .env.prod -f docker-compose.prod.yml exec api curl -sf http://localhost:8000/health
docker compose --env-file .env.prod -f docker-compose.prod.yml exec api curl -sf http://localhost:8000/api/v1/system/status
```

После подключения публичного API домена:

```bash
curl -sf https://api.energy-copilot.<domain>/health
curl -sf https://api.energy-copilot.<domain>/api/v1/system/status
```

## Seed И Import Данных

Создать пилотную станцию:

```bash
curl -X POST "https://api.energy-copilot.<domain>/api/v1/solar-plants" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Варваринская СЭС",
    "capacity_kw": 22600,
    "latitude": 52.86,
    "longitude": 63.26,
    "timezone": "Asia/Almaty",
    "status": "active"
  }'
```

Сохраните returned `id` как `PLANT_ID`.

Импортировать фактическую телеметрию:

```bash
curl -X POST "https://api.energy-copilot.<domain>/api/v1/actual-generation/import-csv" \
  -F "solar_plant_id=$PLANT_ID" \
  -F "file=@docs/sample-data/test_station_telemetry.csv"
```

Импортировать прогноз:

```bash
curl -X POST "https://api.energy-copilot.<domain>/api/v1/forecast-runs/import-csv" \
  -F "plant_id=$PLANT_ID" \
  -F "file=@docs/sample-data/test_forecast_runs.csv"
```

Ожидаемый результат для обоих импортов:

- `imported_rows > 0`
- `rejected_rows = 0`

## Netlify Frontend

Frontend деплоится отдельно из `apps/web` на Netlify.

Рекомендуемые настройки:

- Base directory: `apps/web`
- Build command: `npm run build`
- Publish directory: `.next`
- Runtime: Netlify Next.js support

В Netlify нужно задать env:

```env
NEXT_PUBLIC_API_URL=https://api.energy-copilot.<domain>
```

Тот же frontend origin нужно добавить в backend `CORS_ORIGINS`, например:

```env
CORS_ORIGINS=https://energy-copilot-demo.netlify.app,https://energy-copilot.<domain>
```

Если `NEXT_PUBLIC_API_URL` не задан, frontend будет вызывать same-origin `/api`, что не подходит для Netlify без отдельного proxy rule.

## Checklist Перед Ручной Проверкой

- `docker compose ... config` проходит
- API container healthy
- `alembic upgrade head` выполнен
- `/health` возвращает `200`
- `/api/v1/system/status` возвращает `200`
- Netlify build завершился
- `NEXT_PUBLIC_API_URL` указывает на HTTPS API domain
- `CORS_ORIGINS` содержит Netlify/custom frontend domain
- Actual CSV import работает
- Forecast CSV import работает
- Accuracy Lab показывает реальные метрики

## Риски

- Для публичного demo access пока нет production auth/RBAC.
- Sample timestamps исторические, поэтому Alerts могут честно показывать stale/offline telemetry.
- Неверный `CORS_ORIGINS` заблокирует запросы из Netlify.
- Неверный `NEXT_PUBLIC_API_URL` отправит frontend на неправильный API.
- Запуск локального `docker-compose.yml` на сервере может конфликтовать с PetroAI портами и container names.
- `.env.prod` содержит секреты и не должен попадать в git.
