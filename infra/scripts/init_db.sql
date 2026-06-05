-- ============================================================
--  Energy Copilot AI — Database Init Script
--  Выполняется автоматически при первом запуске PostgreSQL
-- ============================================================

-- Включаем расширение TimescaleDB для хранения телеметрии
CREATE EXTENSION IF NOT EXISTS timescaledb CASCADE;

-- Расширение для работы с UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Расширение для хэширования паролей (опционально)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Сообщение об успешной инициализации
DO $$
BEGIN
    RAISE NOTICE 'Energy Copilot AI: база данных инициализирована успешно';
    RAISE NOTICE 'TimescaleDB: %', (SELECT default_version FROM pg_available_extensions WHERE name = 'timescaledb');
END $$;
