# Перевірка (Task A, Task B, бонус E)

- **Інструмент і версія, модель:** Claude Code 2.1.197 · <модель — перевір через /model>
- **ОС і термінал, Node:** Windows · Git Bash · Node <вивід node --version> · MCP Inspector 2.8.0 · `@modelcontextprotocol/server` 2.1.0 · `zod` 4.6.5

## Task A — сервер в Inspector

- Команди, якими зроблено чотири файли в `docs/mcp/`: рівно як у walkthrough, крок 4 — чотири виклики
  `npx -y @modelcontextprotocol/inspector@2.8.0 --cli node mcp/leaddesk-server/src/server.mjs` з
  `--method tools/list`, двома `--method tools/call` і `--method resources/read --uri leaddesk://reference/statuses`.
  Усе з Git Bash, з кореня репозиторію, без змін у командах. Кожен виклик піднімає сервер заново, тож
  стан щоразу чистий і `lead_0002` на старті завжди `new`.
- `tools-list.json`: два інструменти. `leaddesk_find_leads` — `"readOnlyHint": true`,
  `leaddesk_set_lead_status` — `"readOnlyHint": false`. У схемах видно саме тексти з `.describe(…)`:
  модель читає, що `any` означає «усі статуси», що `limit` від 1 до 50, що `leadId` має вигляд
  `lead_0002`, і що `reason` обов'язковий. В описі `leaddesk_set_lead_status` прямо сказано, що він
  змінює дані, що перед викликом потрібне підтвердження людини, і що id треба спершу знайти через
  `leaddesk_find_leads`.
- `bad-input.json`: ламав `leadId` — передав `nope` замість `^lead_\d{4}$`, зі `status=won`.
  Результат — `"isError": true` з підказкою знайти правильний id через `leaddesk_find_leads`.
  Inspector завершився з кодом **5** і надрукував у stderr
  `{"error":{"code":"tool_is_error","message":"Tool 'leaddesk_set_lead_status' returned isError:true."}}`.
- `set-status.json`: лід `lead_0002`, `new` → `contacted`, `reason=перевірка в Inspector`.
  Створено запис аудиту форми `AuditEntry` з `lib/types.ts` — `{ action: "lead.status_changed",
  leadId: "lead_0002", at: <ISO-час> }`, плюс `from`, `to` і `reason`; запис повернувся в
  `structuredContent.audit` разом із новим станом ліда. Фікстура не змінилася:
  `cmp materials/leads.json mcp/leaddesk-server/fixtures/leads.json` проходить, зміни живуть лише в
  пам'яті процесу. Рядок журналу `status changed: lead_0002 new -> contacted` пішов у stderr через
  `console.error` і в JSON-артефакт не потрапив; `grep -rc 'console\.log' mcp/leaddesk-server/src` дає 0.
- Що було найважче в описах інструментів і параметрів: найважче було писати опис не як документацію
  для людини, а як єдине джерело, за яким модель вирішує, що викликати. Для `leaddesk_set_lead_status`
  довелося явно сказати три речі, які людині здаються очевидними: що інструмент змінює дані, що перед
  викликом потрібне підтвердження, і що `leadId` не вигадується, а береться з `leaddesk_find_leads`.
  Без останнього модель спокушається підставити правдоподібний `lead_0001`. Окремо незвично було
  описувати `leaddesk_find_leads` через те, чого він **не** повертає: імені, email і тексту заявки в
  результаті немає, і це варто сказати прямо, інакше модель шукатиме ці поля або попросить інший
  інструмент. Ще один момент — `any` у `status`: без опису це просто ще один рядок в enum, і незрозуміло,
  що він означає «усі статуси», а не шостий статус поряд із `new` і `lost`.

## Task B — що зробили агенти з серверами

- **Supabase:** <які інструменти викликав агент для міграції й сиду; що ви схвалили вручну; чи щось відхилили>
- **Vercel:** <як задеплоїли (git-інтеграція); яким інструментом отримали лог; що в ньому>
- **Figma:** <`whoami`: план і сіт; скільки викликів витратили з квоти; з якого фрейму токени>
- **Playwright:** <ланцюжок інструментів; чи відправилась форма; що в консолі й мережі>
- Що агент зробив сам, без прохання (наприклад, викликав інструмент, який ви не очікували): <… / нічого>

## Task E (бонус)

- Варіант: <E1 HTTP-сервер / E2 отруєний опис / E3 Cursor>
- <команди, виводи, спостереження — див. walkthrough, Task E>