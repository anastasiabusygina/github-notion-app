# github-notion-app

# Техническое задание: GitHub Projects → Notion Sync

## Цель
Создать GitHub App для синхронизации задач из GitHub Projects в базу данных Notion.

## Что синхронизировать

### Из GitHub Projects:
- Задачи (issues) привязанные к проекту
- **Статус задачи в проекте** (Todo, In Progress, Done и т.д.)
- Дата добавления в проект
- Дата перемещения между колонками статусов
- Данные самой задачи (заголовок, описание, номер)

### В Notion создать поля:
```yaml
Title: заголовок задачи
Issue Number: номер
Project Status: статус из проекта (не из issue!)
Added to Project: дата добавления в проект
Status Updated: дата последнего изменения статуса
Repository: репозиторий задачи
Project Name: название проекта
GitHub URL: ссылка на задачу
GitHub ID: уникальный ID
```

## GitHub App настройки

### Permissions:
- Issues: Read
- Projects: Read

### Webhook events:
- Project card (created, moved, deleted)
- Issues (для отслеживания изменений в самих задачах)

## Логика работы

```python
# Получить данные из GitHub Projects (v2)
def fetch_project_items():
    # Используем GraphQL API для Projects v2
    query = """
    {
      node(id: "PROJECT_ID") {
        ... on ProjectV2 {
          items(first: 100) {
            nodes {
              id
              content {
                ... on Issue {
                  number
                  title
                  body
                  repository {
                    name
                  }
                }
              }
              fieldValues(first: 10) {
                nodes {
                  ... on ProjectV2ItemFieldSingleSelectValue {
                    name  # Status: Todo, In Progress, Done
                    field {
                      ... on ProjectV2SingleSelectField {
                        name
                      }
                    }
                  }
                  ... on ProjectV2ItemFieldDateValue {
                    date
                    field {
                      ... on ProjectV2Field {
                        name
                      }
                    }
                  }
                }
              }
              createdAt
              updatedAt
            }
          }
        }
      }
    }
    """
    
# Синхронизация в Notion
def sync_project_item_to_notion(item):
    status = get_item_status(item)  # Получить статус из fieldValues
    
    data = {
        'title': item.content.title,
        'number': item.content.number,
        'project_status': status,  # Todo/In Progress/Done
        'added_date': item.createdAt,
        'status_updated': item.updatedAt,
        'repository': item.content.repository.name,
        'project_name': project.name
    }
```

## Важно
- Статусы берутся из **колонок проекта**, а не из состояния issue
- Используется GitHub Projects v2 API (GraphQL)
- При перемещении задачи между колонками - обновляется статус в Notion

---

Только синхронизация задач из GitHub Projects со статусами проекта.
