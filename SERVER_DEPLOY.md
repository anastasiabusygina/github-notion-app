# Инструкция по развертыванию на сервере

## Требования к серверу
- Ubuntu 20.04+ или аналогичная ОС
- Node.js 18+ 
- Git
- Nginx (для проксирования)

## Шаги развертывания

### 1. Подключитесь к серверу
```bash
ssh user@your-server.com
```

### 2. Установите Node.js (если еще не установлен)
```bash
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs
```

### 3. Клонируйте репозиторий
```bash
cd ~
git clone git@github.com:anastasiabusygina/github-notion-app.git
cd github-notion-app
```

### 4. Создайте .env файл
```bash
cp .env.example .env
nano .env
```
Заполните все переменные из вашего локального .env файла.

### 5. Запустите скрипт развертывания
```bash
./deploy.sh
```

### 6. Настройте Nginx
Создайте конфигурацию:
```bash
sudo nano /etc/nginx/sites-available/github-notion-sync
```

Вставьте:
```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Активируйте сайт:
```bash
sudo ln -s /etc/nginx/sites-available/github-notion-sync /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### 7. Настройте SSL (рекомендуется)
```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
```

### 8. Обновите GitHub App
1. Перейдите в настройки вашего GitHub App
2. Обновите Webhook URL на: `https://your-domain.com/webhook`

## Управление приложением

### Просмотр статуса
```bash
pm2 status
```

### Просмотр логов
```bash
pm2 logs github-notion-sync
```

### Перезапуск
```bash
pm2 restart github-notion-sync
```

### Остановка
```bash
pm2 stop github-notion-sync
```

### Обновление кода
```bash
git pull
npm install --production
pm2 restart github-notion-sync
```

## Мониторинг

### В реальном времени
```bash
pm2 monit
```

### Веб-интерфейс (опционально)
```bash
pm2 install pm2-web
# Откройте http://your-server:9615
```

## Безопасность

1. **Firewall**: Откройте только нужные порты
```bash
sudo ufw allow 22/tcp  # SSH
sudo ufw allow 80/tcp  # HTTP
sudo ufw allow 443/tcp # HTTPS
sudo ufw enable
```

2. **Обновления**: Регулярно обновляйте зависимости
```bash
npm audit
npm update
```

3. **Бэкапы**: Сохраняйте .env файл в безопасном месте

## Решение проблем

### Приложение не запускается
```bash
# Проверьте логи
pm2 logs github-notion-sync --lines 100

# Проверьте .env файл
cat .env
```

### Webhook не работает
1. Проверьте Nginx: `sudo nginx -t`
2. Проверьте доступность: `curl https://your-domain.com/health`
3. Проверьте логи: `pm2 logs`

### Высокая нагрузка
```bash
# Проверьте использование ресурсов
pm2 monit

# При необходимости увеличьте лимит памяти в ecosystem.config.js
```