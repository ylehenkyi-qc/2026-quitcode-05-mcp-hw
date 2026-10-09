# LeadDesk MCP server

Доменний MCP-сервер для роботи з лідами: два бізнес-дієслова замість SQL на всю базу.

## Інструменти й ресурс

| Ім'я | Що робить | Анотації |
|---|---|---|
| `leaddesk_find_leads` | ліди за статусом, найновіші першими | `readOnlyHint: true` |
| `leaddesk_set_lead_status` | змінює статус ліда й пише запис в аудит | `readOnlyHint: false` |
| `leaddesk://reference/statuses` | ресурс `text/markdown`: що означає кожен статус | — |

`leaddesk_find_leads` повертає лише `id`, `company`, `status`, `source`, `budget`, `createdAt`.
Імені, email і тексту заявки агент не бачить.

## Запуск

```bash
npm install
node src/server.mjs
```

Сервер читає `fixtures/leads.json` один раз і тримає зміни **в пам'яті процесу**; файл фікстури
не переписується ніколи. Інший шлях до фікстури — змінна `LEADDESK_FIXTURE`.

## Перевірка Inspector'ом

З кореня репозиторію, Git Bash:

```bash
npx -y @modelcontextprotocol/inspector@2.8.0 --cli node mcp/leaddesk-server/src/server.mjs --method tools/list

npx -y @modelcontextprotocol/inspector@2.8.0 --cli node mcp/leaddesk-server/src/server.mjs \
  --method tools/call --tool-name leaddesk_find_leads --tool-arg status=new --tool-arg limit=5

npx -y @modelcontextprotocol/inspector@2.8.0 --cli node mcp/leaddesk-server/src/server.mjs \
  --method resources/read --uri leaddesk://reference/statuses
```

Кожен виклик піднімає сервер заново, тож стан щоразу чистий.
Артефакти перевірки — у `docs/mcp/`.

## Підключення до Claude Code

Скоуп `local`, з порожньої теки поза репозиторієм (як у Task C):

```bash
claude mcp add leaddesk -- node "<шлях до репозиторію>/mcp/leaddesk-server/src/server.mjs"
```

Видалити: `claude mcp remove leaddesk`.