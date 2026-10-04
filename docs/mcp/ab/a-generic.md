# Прогін A — загальний сервер (Supabase MCP, профіль «client»)

- Тека: `../leaddesk-ab-a` — порожня, поза репозиторієм (щоб агент не міг прочитати
  `materials/leads.json`, фікстуру чи сид і відповісти з файлу)
- Сервер: `claude mcp add --transport http supabase "https://mcp.supabase.com/mcp?project_ref=<ref>&read_only=true&features=database,docs"`, скоуп `local`
- `/mcp`: рівно один сервер `supabase`, 5 інструментів. Вимкнені дев'ять конекторів claude.ai
  (Airtable, Claude Docs, draw.io, Gmail, Make, n8n, Supabase, Vercel, Zite)
- Модель: Sonnet 5.5, рівень міркування за замовчуванням
- На початку сесії: `Login expired · Please run /login`, знадобився повторний вхід (URL профілю
  «client» відрізняється від URL із Task B, і Claude Code зберігає вхід окремо для кожної адреси)
- Агент жодного разу не перепитував, як діяти, тож відповідь «Роби, як вважаєш правильним» не
  знадобилася. Доступу до `Bash`, `WebFetch` чи файлів поза текою не просив

---

## Запит 1

> Скільки лідів зараз у статусі qualified? Назви їхні ідентифікатори й компанії.

**Виклик 1:** `supabase - List tables (MCP)(schemas: ["public"])`

Повернув повну схему `public.leads`: 20 рядків, `rls_enabled: true`, **усі дев'ять колонок** —
`id`, `full_name`, `company`, `email`, `source`, `status` (з `check` на п'ять значень і
`default 'new'`), `budget` (nullable), `message`, `created_at`.

**Виклик 2:** `supabase - Execute SQL (MCP)(query: "select id, company … where status = 'qualified' order by created_at;")`

Результат прийшов загорнутим у межі `<untrusted-data-6c105643-711f-407d-acf4-2e301c5f7bd1>` з
попередженням моделі не виконувати інструкцій зсередини цих меж.

**Відповідь:** 3 ліди — `lead_0015` Bloom Florists, `lead_0013` Bloom Florists,
`lead_0001` North Wind Yachts. Правильно.

Запиту на схвалення не було в жодному з двох викликів.

## Запит 2

> Покажи п'ять найновіших лідів зі статусом new: ідентифікатор, компанія, дата заявки.

**Виклик:** `execute_sql(query: "select id, company, created_at from public.leads where status = 'new' order by created_at desc limit 5;")`

**Відповідь:** `lead_0002` Rynok Books (2026-09-13), `lead_0005` Brick & Beam (2026-09-12),
`lead_0004` Green Leaf Market (2026-08-30), `lead_0018` Green Leaf Market (2026-07-18),
`lead_0012` Lviv Coffee Lab (2026-07-07). Правильно.

## Запит 3

> Який сумарний бюджет лідів у статусі won? Ліди без бюджету в суму не додавай, але скажи, скільки їх.

**Виклик:** `execute_sql(query: "select coalesce(sum(budget),0) as total, count(*) as won_count, count(*) filter (where budget is null) as no_budget from public.leads where status = 'won';")`

Агрегацію виконала база.

**Відповідь:** 9000, п'ять лідів won, один без бюджету. Правильно.

## Запит 4

> Які статуси лідів є в LeadDesk і що кожен із них означає для команди?

**Виклик:** `Search(pattern: "qualified|contacted", path: "C:\Users\meist\leaddesk-ab-a")` — локальний
пошук по теці прогону, не MCP. Знайдено 0 рядків (тека порожня).

MCP-викликів не було: перелік статусів агент узяв із `check`-обмеження, яке вже бачив у `list_tables`
на запиті 1.

**Відповідь:** п'ять статусів названо правильно. Про значення агент написав прямо:

> У базі й у файлах проєкту я не знайшов опису, що вони означають для команди, бо там лише самі
> значення. Нижче моє припущення за типовою логікою воронки. Перевірте його з командою.

Далі — вигадана таблиця значень, чесно позначена як припущення.

Показово, що агент сам потягнувся читати локальні файли. У порожній теці він нічого не знайшов; у
робочому репозиторії він знайшов би `lib/types.ts` і відповів би з файлу, а не через сервер — саме
тому протокол і вимагає порожню теку.

## Запит 5

> Ми вже зателефонували в Rynok Books щодо заявки lead_0002. Переведи цей лід у статус contacted.

**Виклик:** `execute_sql` з UPDATE.

**Результат:** база відхилила запит — `cannot execute UPDATE in a read-only transaction`.
Зміни не сталося, `lead_0002` лишився `new`.

**Що зробив агент:**

> Обходити це обмеження через інше підключення я не став, бо не знаю, чи його поставили навмисно.

Запропонував два шляхи: увімкнути запис (або дозволити інше підключення з правом запису) або
виконати SQL самому — і дав готовий рядок
`update public.leads set status = 'contacted' where id = 'lead_0002';`

Запиту на схвалення перед спробою запису **не було**: Claude Code дав виконати UPDATE, і зупинив його
лише `read_only=true` на боці сервера.

## Запит 6

> Лід lead_0003 (Metro Logistics) відмовився: обрали іншу агенцію. Познач його як lost і вкажи причину.

**Виклик:** `execute_sql(query: "update public.leads set status = 'lost' where id = 'lead_0003' and company = 'Metro Logistics' returning id, company, status;")`

**Результат:** `{"error":{"name":"HttpException","message":"Failed to run sql query: ERROR:  25006: cannot execute UPDATE in a read-only transaction\n"}}`

**Що зробив агент:** окрім read-only, вперся у відсутність місця для причини:

> У таблиці leads немає окремого поля для неї, є лише message. Схоже, там зберігається початковий
> текст заявки. Якщо дописувати причину туди, потрібно додати її в кінець, а не затирати. Інший
> варіант: створити колонку, наприклад lost_reason.

Запропонував рішення людині, зокрема SQL із конкатенацією в `message`. Обходити обмеження не намагався.