# Пошаговая инструкция по настройке GitHub Projects → Notion Sync

## Что делает приложение
Автоматически синхронизирует задачи из GitHub Projects в базу данных Notion. Отслеживает статусы задач в колонках проекта (не путать со статусом issue).

## Шаг 1: Подготовка Notion

### 1.1 Создайте интеграцию
1. Перейдите на https://www.notion.so/my-integrations
2. Нажмите "New integration"
3. Дайте название (например, "GitHub Sync")
4. Выберите workspace
5. Скопируйте API ключ (начинается с `ntn_`)

### 1.2 Создайте базу данных
1. Создайте новую страницу с базой данных (Database - Full page)
2. Добавьте следующие поля (Properties):
   - **Title** (title) - уже есть по умолчанию
   - **Issue Number** (number) - номер задачи
   - **Project Status** (select) - статус из колонки проекта
   - **Added to Project** (date) - дата добавления в проект
   - **Status Updated** (date) - дата изменения статуса
   - **Repository** (text) - название репозитория
   - **Project Name** (text) - название проекта
   - **GitHub URL** (url) - ссылка на issue
   - **GitHub ID** (text) - уникальный идентификатор

### 1.3 Поделитесь базой с интеграцией
1. В правом верхнем углу базы нажмите "Share"
2. Нажмите "Invite"
3. Выберите вашу интеграцию из списка
4. Нажмите "Invite"

### 1.4 Получите ID базы данных
1. Скопируйте URL базы данных
2. ID - это часть между последним `/` и `?`:
   ```
   https://www.notion.so/workspace/22a0e4c07062802798adf3cc0b0b6d95?v=...
                                    ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
   ```

## Шаг 2: Создание GitHub App

### 2.1 Создайте приложение
1. Перейдите на https://github.com/settings/apps/new
2. Заполните:
   - **GitHub App name**: уникальное имя
   - **Homepage URL**: любой URL (например, https://github.com)
   - **Webhook URL**: временно укажите https://example.com
   - **Webhook secret**: придумайте пароль

### 2.2 Настройте права доступа
В разделе **Repository permissions**:
- **Issues**: Read
- **Projects**: Read

В разделе **Subscribe to events**:
- ✅ Projects v2 item
- ✅ Project card (опционально)

### 2.3 Создайте приложение
1. Нажмите "Create GitHub App"
2. Сохраните **App ID**
3. Нажмите "Generate a private key" - скачается .pem файл

## Шаг 3: Получение ID проекта

### 3.1 Создайте Personal Access Token (если проект приватный)
1. Перейдите на https://github.com/settings/tokens/new
2. Выберите права: `project` (Full control)
3. Создайте токен

### 3.2 Найдите Project ID
Используйте GitHub Action (как мы сделали) или GraphQL Explorer:
1. https://docs.github.com/en/graphql/overview/explorer
2. Выполните запрос:
```graphql
{
  viewer {
    projectsV2(first: 20) {
      nodes {
        id
        title
        url
      }
    }
  }
}
```

## Шаг 4: Настройка приложения

### 4.1 Клонируйте репозиторий
```bash
git clone git@github.com:anastasiabusygina/github-notion-app.git
cd github-notion-app
```

### 4.2 Установите зависимости
```bash
npm install
```

### 4.3 Настройте переменные окружения
Создайте файл `.env`:
```env
# GitHub App Configuration
GITHUB_APP_ID=1553959
GITHUB_APP_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----
...содержимое .pem файла...
-----END RSA PRIVATE KEY-----"
GITHUB_WEBHOOK_SECRET=ваш_webhook_secret

# Notion Configuration  
NOTION_API_KEY=ntn_ваш_ключ_интеграции
NOTION_DATABASE_ID=id_вашей_базы_данных

# Server Configuration
PORT=3000

# GitHub Project Configuration
GITHUB_PROJECT_ID=PVT_kwHOBVrc7M4A9bFF
```

## Шаг 5: Запуск и тестирование

### 5.1 Для локального тестирования
```bash
# Терминал 1: запустите приложение
npm start

# Терминал 2: запустите ngrok
npx ngrok http 3000
```

### 5.2 Обновите Webhook URL
1. Скопируйте URL от ngrok (например: https://abc123.ngrok.io)
2. В настройках GitHub App обновите Webhook URL на:
   ```
   https://abc123.ngrok.io/webhook
   ```

### 5.3 Установите приложение
1. В настройках GitHub App нажмите "Install App"
2. Выберите аккаунт
3. Выберите репозитории с задачами

## Шаг 6: Развертывание на сервере

### Варианты хостинга:
1. **Render.com** - бесплатный план
2. **Railway.app** - $5 кредитов/месяц
3. **Fly.io** - бесплатный план для маленьких приложений
4. **VPS** - любой сервер с Node.js

### Для VPS:
```bash
# Установите PM2
npm install -g pm2

# Запустите приложение
pm2 start index.js --name github-notion-sync

# Сохраните конфигурацию
pm2 save
pm2 startup
```

## Как это работает

1. **GitHub отправляет webhook** при изменении в проекте
2. **Приложение получает событие** и проверяет подпись
3. **Запрашивает детали через GraphQL API**
4. **Синхронизирует с Notion**:
   - Создает новые записи
   - Обновляет существующие
   - Удаляет при необходимости

## Важные моменты

- Синхронизируется **статус из колонки проекта**, не статус issue
- Работает только с GitHub Projects v2
- Приложение должно быть установлено на репозитории с задачами
- Если в проекте задачи из разных репозиториев - синхронизируются только те, где установлено приложение

## Отладка

### Проверка логов:
```bash
# Локально
npm start

# На сервере с PM2
pm2 logs github-notion-sync
```

### Частые проблемы:
1. **"Missing signature"** - проверьте webhook secret
2. **"Unauthorized"** - проверьте private key
3. **Не синхронизируется** - проверьте установку приложения на репозиторий
4. **Ошибка Notion** - проверьте права интеграции на базу данных

## Полезные команды

```bash
# Ручная синхронизация всего проекта
node sync-project.js <installation-id>

# Проверка здоровья
curl http://localhost:3000/health

# Тест webhook (с ngrok)
curl -X POST https://your-ngrok-url.ngrok.io/webhook \
  -H "Content-Type: application/json" \
  -d '{"action": "test"}'
```