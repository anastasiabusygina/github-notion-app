#!/bin/bash

# Быстрое развертывание на сервере 103.7.55.77

SERVER_IP="103.7.55.77"
SERVER_USER="root"

echo "🚀 Развертывание GitHub-Notion Sync на $SERVER_IP"

# Копируем файлы на сервер
echo "📦 Копируем файлы на сервер..."
ssh $SERVER_USER@$SERVER_IP "mkdir -p ~/github-notion-app"
scp -r ./* $SERVER_USER@$SERVER_IP:~/github-notion-app/

# Копируем .env файл отдельно (он не включен в ./*)
scp .env $SERVER_USER@$SERVER_IP:~/github-notion-app/

# Подключаемся и настраиваем
echo "⚙️  Настраиваем приложение на сервере..."
ssh $SERVER_USER@$SERVER_IP << 'EOF'
cd ~/github-notion-app

# Устанавливаем Node.js если нет
if ! command -v node &> /dev/null; then
    echo "📦 Устанавливаем Node.js..."
    curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
    apt-get install -y nodejs
fi

# Устанавливаем PM2
if ! command -v pm2 &> /dev/null; then
    npm install -g pm2
fi

# Устанавливаем зависимости
npm install --production

# Создаем директорию для логов
mkdir -p logs

# Останавливаем старую версию
pm2 stop github-notion-sync 2>/dev/null || true
pm2 delete github-notion-sync 2>/dev/null || true

# Запускаем приложение
pm2 start ecosystem.config.js

# Сохраняем конфигурацию
pm2 save
pm2 startup systemd -u root --hp /root

# Открываем порт в firewall
ufw allow 3000/tcp
ufw --force enable

echo "✅ Готово!"
pm2 status
EOF

echo ""
echo "✅ Развертывание завершено!"
echo ""
echo "📌 Webhook URL для GitHub App:"
echo "   http://$SERVER_IP:3000/webhook"
echo ""
echo "🔍 Команды для проверки на сервере:"
echo "   ssh $SERVER_USER@$SERVER_IP"
echo "   pm2 logs github-notion-sync"
echo "   pm2 status"