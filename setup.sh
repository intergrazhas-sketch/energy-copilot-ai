#!/bin/bash
# ============================================================
#  Energy Copilot AI — Скрипт первого запуска
#  Использование: bash setup.sh
# ============================================================

set -e

echo "============================================"
echo "  Energy Copilot AI — Первый запуск"
echo "============================================"
echo ""

# 1. Проверяем Docker
if ! command -v docker &> /dev/null; then
    echo "❌ Docker не установлен."
    echo "   Установи Docker Desktop: https://www.docker.com/products/docker-desktop"
    exit 1
fi
echo "✓ Docker найден"

# 2. Проверяем Docker Compose
if ! docker compose version &> /dev/null; then
    echo "❌ Docker Compose не найден"
    exit 1
fi
echo "✓ Docker Compose найден"

# 3. Создаём .env если не существует
if [ ! -f .env ]; then
    echo ""
    echo "→ Создаю файл .env из шаблона..."
    cp .env.example .env
    echo "✓ Файл .env создан"
    echo "  ⚠️  Открой .env и добавь свои API ключи (OpenAI и т.д.)"
else
    echo "✓ Файл .env уже существует"
fi

# 4. Устанавливаем пароль MQTT
echo ""
echo "→ Настройка MQTT брокера..."
MQTT_USER_NAME=${MQTT_USER:-ec_mqtt}
MQTT_PASS=${MQTT_PASSWORD:-ec_mqtt_password}
# Создаём временный контейнер для генерации пароля
docker run --rm \
    -v "$(pwd)/infra/mqtt:/work" \
    eclipse-mosquitto:2 \
    sh -c 'rm -f /work/passwd && mosquitto_passwd -c -b /work/passwd "$1" "$2"' \
    sh "$MQTT_USER_NAME" "$MQTT_PASS"
echo "✓ MQTT пароль настроен"

# 5. Создаём __init__.py файлы для Python пакетов
mkdir -p apps/api/app apps/ai/app
touch apps/api/app/__init__.py
touch apps/ai/app/__init__.py
echo "✓ Python пакеты инициализированы"

# 6. Запускаем стек
echo ""
echo "→ Запускаю все сервисы..."
echo "  (первый запуск занимает 3–5 минут — скачиваются образы)"
echo ""
docker compose up --build -d

# 7. Ждём запуска
echo ""
echo "→ Жду запуска сервисов..."
sleep 15

# 8. Проверяем сервисы
echo ""
echo "============================================"
echo "  Проверка сервисов:"
echo "============================================"

check_service() {
    local name=$1
    local url=$2
    if curl -sf "$url" > /dev/null 2>&1; then
        echo "  ✓ $name — работает ($url)"
    else
        echo "  ⚠ $name — ещё запускается..."
    fi
}

check_service "Backend API"   "http://localhost:8000/health"
check_service "AI Service"    "http://localhost:8001/health"
check_service "Frontend"      "http://localhost:3000"
check_service "Qdrant"        "http://localhost:6333/healthz"

echo ""
echo "============================================"
echo "  Адреса для браузера:"
echo "============================================"
echo "  🌐 Платформа:    http://localhost"
echo "  📡 API:          http://localhost:8000/api/docs"
echo "  🤖 AI Service:   http://localhost:8001/docs"
echo "  🔍 Qdrant UI:    http://localhost:6333/dashboard"
echo ""
echo "  Логи: docker compose logs -f"
echo "============================================"
