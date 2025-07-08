#!/bin/bash

# Скрипт для развертывания на сервере

echo "🚀 Начинаем развертывание GitHub-Notion Sync..."

# Проверяем наличие Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js не установлен. Установите Node.js 18+ и попробуйте снова."
    exit 1
fi

# Проверяем наличие PM2
if ! command -v pm2 &> /dev/null; then
    echo "📦 Устанавливаем PM2..."
    npm install -g pm2
fi

# Устанавливаем зависимости
echo "📦 Устанавливаем зависимости..."
npm install --production

# Проверяем наличие .env файла
if [ ! -f .env ]; then
    echo "❌ Файл .env не найден!"
    echo "Создайте .env файл на основе .env.example"
    exit 1
fi

# Создаем директорию для логов
mkdir -p logs

# Останавливаем старую версию (если есть)
pm2 stop github-notion-sync 2>/dev/null || true
pm2 delete github-notion-sync 2>/dev/null || true

# Запускаем приложение
echo "🚀 Запускаем приложение..."
pm2 start ecosystem.config.js

# Сохраняем конфигурацию PM2
pm2 save

# Настраиваем автозапуск
echo "⚙️  Настраиваем автозапуск..."
pm2 startup systemd -u $USER --hp $HOME

echo "✅ Развертывание завершено!"
echo ""
echo "📊 Полезные команды:"
echo "  pm2 status          - статус приложения"
echo "  pm2 logs            - просмотр логов"
echo "  pm2 restart all     - перезапуск"
echo "  pm2 monit           - мониторинг в реальном времени"
echo ""
echo "🔗 Не забудьте обновить Webhook URL в настройках GitHub App!"
echo "   URL: https://ваш-домен.com/webhook"