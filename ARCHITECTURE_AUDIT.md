# Energy Copilot AI — Architecture Audit

## Текущее Состояние

Git чистый, ветка `main` синхронизирована с GitHub.

Docker stack стабилен: `postgres`, `redis`, `qdrant`, `mqtt`, `api`, `ai`, `web`, `nginx` работают. Ключевые инфраструктурные сервисы находятся в состоянии `healthy`.

## Что Уже Реализовано

- Phase 1 infrastructure: PostgreSQL/TimescaleDB, Redis, Qdrant, MQTT, API, AI service, Web, Nginx.
- Backend Foundation: FastAPI структура, `/health`, `/api/v1/system/status`.
- Forecast Intelligence MVP: станции, providers, forecast runs, forecast values, actual generation, accuracy metrics.
- MQTT ingestion: прием actual generation через `plants/{plant_id}/generation/actual`.
- Upsert actual generation по `solar_plant_id + timestamp`.
- Автоматический пересчет accuracy после прихода факта.
- Provider comparison: сравнение `manual` и `mock`, выбор best provider.
- Accuracy Lab MVP: дневные агрегаты, ranking providers, summary.
- Alembic migrations для forecast tables и accuracy aggregates.
- GitHub repository подключен, актуальные этапы запушены.

## Что Готово Для Пилота СЭС

- Прием 15-минутной фактической генерации.
- Хранение факта в TimescaleDB hypertable `actual_generation`.
- Хранение прогнозов в hypertable `forecast_values`.
- Расчет `MAPE`, `RMSE`, `MAE`, `Bias`.
- Сравнение forecast providers.
- Исторические дневные агрегаты Accuracy Lab.
- MQTT broker с авторизацией.
- API endpoints для проверки состояния системы.

Для пилота это уже хороший backend-скелет: можно принимать телеметрию, хранить факт, сравнивать прогноз с фактом и видеть качество provider-ов.

## Архитектурные Риски

- Нет production-auth: API сейчас без авторизации и RBAC.
- Секреты dev-уровня: пароли и ключи пока дефолтные.
- API работает в development режиме с `--reload`.
- MQTT subscriber живет внутри API-процесса. Для production с несколькими worker-ами это может дать дубли подписчиков.
- Нет централизованного логирования, метрик и алертов.
- Нет автоматических тестов.
- Нет политики миграций для production.
- Нет backup/restore сценария для PostgreSQL volumes.
- Нет tenant/project separation, если позже будет несколько клиентов.
- Нет DLQ или таблицы rejected telemetry для плохих MQTT сообщений.
- Accuracy recalculation сейчас синхронный и может стать дорогим.

## Узкие Места При Росте Данных

- `actual_generation` и `forecast_values` будут расти быстро: 15 минут × станции × годы.
- Автопересчет accuracy при каждом факте может стать тяжелым, если много forecast runs на один timestamp.
- Provider ranking и Accuracy Lab могут давить PostgreSQL, если часто пересчитывать большие периоды.
- MQTT subscriber внутри API не масштабируется чисто.
- Один PostgreSQL без реплик и backup strategy.
- Нет retention/compression policy для TimescaleDB.
- Нет очереди задач для фоновых пересчетов.
- Nginx/API пока не разделены на production profiles.

## Что Нужно До Деплоя На Serverscore

Critical перед сервером:

- Заменить все dev-секреты через `.env` на реальные.
- Закрыть публичный доступ к PostgreSQL, Redis, Qdrant, MQTT, если он не нужен извне.
- Настроить production `docker-compose` или profile без `--reload`.
- Настроить домен, TLS, Nginx reverse proxy.
- Настроить firewall/security groups.
- Настроить backup PostgreSQL volumes.
- Настроить Alembic migration workflow.
- Добавить healthchecks и restart policy для production.
- Добавить базовый monitoring: logs, disk, RAM, CPU, container status.
- Проверить, что GitHub не содержит `.env` и реальных секретов.

## Что Нужно До Первого Пилота С Реальной СЭС

Обязательно:

- Утвердить MQTT topic contract и JSON payload.
- Сделать отдельные MQTT credentials для станции.
- Проверить часовой пояс и договориться: хранить timestamp в UTC.
- Добавить обработку плохих сообщений: rejected telemetry log/table.
- Добавить validation на диапазоны мощности: не больше установленной мощности станции.
- Сделать load test на 15-минутную телеметрию.
- Сделать runbook: как перезапустить, где логи, как проверить данные.
- Настроить backup и восстановление.
- Добавить минимальные API tests.
- Добавить seed/onboarding сценарий для пилотной станции.
- Решить, кто и как загружает forecast values: manual/mock сейчас есть, реальный provider позже.

## Roadmap

### Critical

- Production secrets и `.env` hygiene.
- Production Docker profile без reload.
- Закрытие публичных портов БД/Redis/Qdrant.
- Backup/restore PostgreSQL.
- MQTT rejected messages и базовый audit log.
- API tests для health, ingestion, forecast, accuracy.

### High

- Вынести MQTT subscriber/accuracy recalculation в отдельный worker.
- Добавить очередь задач: Redis/Celery или lightweight worker.
- Retention/compression policy TimescaleDB.
- Station-specific MQTT credentials.
- CI check: lint/test/migrations.
- Production Nginx TLS config.

### Medium

- Weekly/monthly Accuracy Lab aggregation.
- Provider config lifecycle.
- Solcast adapter preparation, без реального подключения ключей в код.
- Data quality flags для actual generation.
- API pagination/filtering для больших списков.
- Basic observability dashboard.

### Low

- UI для Accuracy Lab.
- Расширенные provider rankings.
- Multi-tenant модель.
- Advanced alerting.
- ML/Forecast Engine.
- AI Engineer/RAG.
- Digital Twin.
