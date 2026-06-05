# Energy Copilot AI — Phase 1 Report

## Статус

Phase 1 завершена и принята.

Локальная инфраструктура проекта запускается через Docker Compose. Полный стек поднимается командой:

```bash
docker compose up -d
```

После запуска контейнеры находятся в стабильном состоянии. Базовые сервисы имеют `healthy`, frontend и nginx находятся в состоянии `running`.

## Архитектура Phase 1

Phase 1 — это локальный фундамент проекта. На этом этапе подняты сервисы, которые нужны для дальнейшей разработки backend, frontend и AI-функций.

Состав архитектуры:

- PostgreSQL + TimescaleDB — основная база данных и хранение временных рядов.
- Redis — кэш, очереди задач и pub/sub.
- Qdrant — векторная база для будущих AI/RAG-сценариев.
- MQTT broker — прием телеметрии от IoT-устройств.
- API service — минимальный FastAPI backend с `/health`.
- AI service — минимальный FastAPI AI-сервис с `/health`.
- Web frontend — минимальный Next.js frontend.
- Nginx — локальная входная точка и reverse proxy.

Сейчас это не бизнес-логика продукта, а рабочая инфраструктурная база для следующих фаз.

## Контейнеры

| Контейнер | Сервис | Назначение | Порт | Состояние |
|---|---|---|---|---|
| `ec_postgres` | `postgres` | PostgreSQL + TimescaleDB | `5432` | `healthy` |
| `ec_redis` | `redis` | Redis cache/queue/pubsub | `6379` | `healthy` |
| `ec_qdrant` | `qdrant` | Векторная база данных | `6333`, `6334` | `healthy` |
| `ec_mqtt` | `mqtt` | MQTT broker для IoT | `1883`, `9001` | `healthy` |
| `ec_api` | `api` | FastAPI backend | `8000` | `healthy` |
| `ec_ai` | `ai` | FastAPI AI service | `8001` | `healthy` |
| `ec_web` | `web` | Next.js frontend | `3000` | `running` |
| `ec_nginx` | `nginx` | Reverse proxy | `80` | `running` |

## URL для проверки

- Frontend через nginx: http://localhost
- Frontend напрямую: http://localhost:3000
- API health: http://localhost:8000/health
- API docs: http://localhost:8000/api/docs
- AI health: http://localhost:8001/health
- AI docs: http://localhost:8001/docs
- Qdrant UI: http://localhost:6333/dashboard
- MQTT broker: `localhost:1883`
- MQTT WebSocket: `localhost:9001`

## Что было исправлено

### MQTT

MQTT-контейнер запускался, но был `unhealthy`.

Причина: файл `infra/mqtt/passwd` был невалидным для Mosquitto. Брокер требовал авторизацию, но пользователь `ec_mqtt` не был нормально создан.

Исправлено:

- создан валидный password-файл для Mosquitto;
- healthcheck MQTT теперь проходит с логином и паролем;
- `setup.sh` поправлен, чтобы не создавать битый password-файл повторно.

### Qdrant

Qdrant работал, но Docker показывал `unhealthy`.

Причина: healthcheck использовал `curl`, а внутри образа Qdrant его нет.

Исправлено:

- healthcheck заменен на проверку доступности HTTP-порта через `bash`;
- контейнер Qdrant теперь стабильно `healthy`.

### Frontend

Web-контейнер уходил в restart loop.

Причины:

- в `apps/web` не было ни `pages`, ни `app`, поэтому Next.js сразу завершался;
- dev-сервер Next.js слушал только внутри контейнера;
- `web` зависел от `api`, хотя frontend можно запускать отдельно.

Исправлено:

- добавлена минимальная страница `apps/web/pages/index.tsx`;
- команда dev-запуска изменена на `next dev -H 0.0.0.0`;
- убрана лишняя зависимость `web` от `api`.

### API и AI

API и AI-сервисы проверены как часть полного Docker Compose.

Исправлено и подтверждено:

- `ec_api` запускается;
- `/health` у API отвечает `200`;
- `ec_ai` запускается;
- `/health` у AI service отвечает `200`.

### Nginx

Nginx падал, когда `api` не был доступен в Docker-сети.

После запуска полного стека `api`, `ai`, `web` и nginx находятся в одной сети, nginx больше не уходит в restart loop и отвечает на `http://localhost`.

## Текущее состояние проекта

- Docker Compose работает.
- Полный стек запускается командой `docker compose up -d`.
- Инфраструктурные контейнеры healthy.
- Frontend доступен в браузере.
- API и AI service имеют health endpoints.
- Nginx работает как локальная входная точка.
- Локальный Git-репозиторий создан.
- `remote origin` пока не подключен.
- Commit и push пока не выполнялись.

## Задачи для Phase 2

Phase 2 не начата. Ниже список задач, которые можно брать после отдельного решения о старте Phase 2.

- Подключить `remote origin`, когда будет известна ссылка Git-репозитория.
- Сделать первый commit и push.
- Добавить базовую структуру backend API без усложнения бизнес-логики.
- Подготовить подключение к PostgreSQL через настройки приложения.
- Подготовить миграции базы данных.
- Добавить базовые модели данных для энергетических активов.
- Добавить простой frontend shell: layout, навигация, страницы-заглушки.
- Настроить единый API-префикс через nginx.
- Добавить простую проверку связки frontend → API.
- Подготовить основу для будущей авторизации, но не внедрять RBAC раньше времени.
- Подготовить основу для приема MQTT-сообщений.
- Подготовить основу для записи телеметрии в PostgreSQL/TimescaleDB.
- Подготовить основу для будущих AI-модулей без реализации Forecast Engine и AI Engineer.

## Важно

Phase 1 не содержит полноценную бизнес-логику.

На этом этапе цель была простая: проект должен стабильно запускаться локально, а основные сервисы должны быть доступны для дальнейшей разработки.
