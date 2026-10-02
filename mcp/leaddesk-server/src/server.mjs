// LeadDesk: доменний MCP-сервер. Два бізнес-дієслова замість SQL на всю базу.
//
//   node src/server.mjs                          фікстура fixtures/leads.json
//   LEADDESK_FIXTURE=/шлях/leads.json node ...   інша фікстура
//
// Дані читаються один раз; зміни живуть лише в пам'яті процесу, файл не переписується.
import { McpServer } from "@modelcontextprotocol/server";
import { serveStdio } from "@modelcontextprotocol/server/stdio";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { z } from "zod";

// Шлях від модуля, а не від поточної теки: Claude Code запускає сервер не з вашого терміналу.
const FIXTURE =
  process.env.LEADDESK_FIXTURE ??
  fileURLToPath(new URL("../fixtures/leads.json", import.meta.url));

const STATUSES = ["new", "contacted", "qualified", "won", "lost"];

const leads = JSON.parse(await readFile(FIXTURE, "utf8"));
const audit = [];

// Назовні йдуть лише ці поля: без fullName, email і message.
const publicLead = (l) => ({
  id: l.id,
  company: l.company,
  status: l.status,
  source: l.source,
  budget: l.budget,
  createdAt: l.createdAt,
});

const REFERENCE = `# Статуси лідів LeadDesk

- **new** — заявка надійшла, з клієнтом ще ніхто не зв'язувався.
- **contacted** — менеджер поговорив із клієнтом: був дзвінок або лист із відповіддю.
- **qualified** — з'ясовано бюджет, строки й хто ухвалює рішення.
- **won** — домовленість підтверджено, договір підписано. Переводить лише керівник відділу.
- **lost** — клієнт відмовився або не відповідає; причину запишіть у reason.
`;

const factory = () => {
  const server = new McpServer({ name: "leaddesk", version: "0.1.0" });

  server.registerTool(
    "leaddesk_find_leads",
    {
      title: "Знайти ліди",
      description:
        "Повертає ліди за статусом, найновіші першими. Тільки читає. " +
        "У кожному ліді: id, company, status, source, budget, createdAt. " +
        "Імені, email і тексту заявки тут немає.",
      inputSchema: {
        status: z
          .enum([...STATUSES, "any"])
          .describe("Який статус шукати: new, contacted, qualified, won, lost; any — усі"),
        limit: z
          .number()
          .int()
          .min(1)
          .max(50)
          .default(10)
          .describe("Скільки лідів повернути, від 1 до 50 (за замовчуванням 10)"),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ status, limit }) => {
      const found = leads
        .filter((l) => status === "any" || l.status === status)
        .sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0))
        .slice(0, limit)
        .map(publicLead);
      const text = found.length
        ? found.map((l) => `${l.id} · ${l.company} · ${l.status} · ${l.budget}`).join("\n")
        : "Лідів із таким статусом немає.";
      return { content: [{ type: "text", text }], structuredContent: { leads: found } };
    },
  );

  server.registerTool(
    "leaddesk_set_lead_status",
    {
      title: "Змінити статус ліда",
      description:
        "ЗМІНЮЄ ДАНІ: переводить лід в інший статус і пише запис в аудит. " +
        "Перед викликом обов'язково отримайте підтвердження людини. " +
        "Не знаєте id: спершу знайдіть його через leaddesk_find_leads. " +
        "Що означає кожен статус, читайте в ресурсі leaddesk://reference/statuses.",
      inputSchema: {
        leadId: z.string().regex(/^lead_\d{4}$/).describe("Ідентифікатор ліда, напр. lead_0002"),
        status: z.enum(STATUSES).describe("Новий статус: new, contacted, qualified, won або lost"),
        reason: z.string().min(3).max(500).describe("Чому змінюємо статус (3–500 символів)"),
      },
      annotations: { readOnlyHint: false },
    },
    async ({ leadId, status, reason }) => {
      const lead = leads.find((l) => l.id === leadId);
      if (!lead) {
        return {
          isError: true,
          content: [
            { type: "text", text: `Лід ${leadId} не знайдено. Знайдіть правильний id через leaddesk_find_leads.` },
          ],
        };
      }
      if (lead.status === status) {
        return {
          isError: true,
          content: [{ type: "text", text: `Лід ${leadId} уже має статус ${status}; нічого не змінено.` }],
        };
      }
      const from = lead.status;
      lead.status = status;
      const entry = {
        action: "lead.status_changed",
        leadId,
        at: new Date().toISOString(),
        from,
        to: status,
        reason,
      };
      audit.push(entry);
      console.error(`status changed: ${leadId} ${from} -> ${status}`);
      return {
        content: [{ type: "text", text: `Статус ${leadId}: ${from} → ${status}. Запис в аудит створено.` }],
        structuredContent: { lead: publicLead(lead), audit: entry },
      };
    },
  );

  server.registerResource(
    "statuses",
    "leaddesk://reference/statuses",
    {
      title: "Довідник статусів",
      description: "Що означає кожен статус для команди й хто його призначає",
      mimeType: "text/markdown",
    },
    async (uri) => ({
      contents: [{ uri: uri.href, mimeType: "text/markdown", text: REFERENCE }],
    }),
  );

  return server;
};

await serveStdio(factory);