import { getEventiList } from "@/config/eventi.registry";
import { listEventi, type EventoPreview } from "@/server-utils/service/eventiQuery";
import type { AuthContext } from "@/server-utils/lib/auth-context";

export type RecentEventsSummary = {
  days: number;
  total: number;
  items: Array<
    EventoPreview & {
      type: string;
      label: string;
    }
  >;
};

export function parseRecentEventsIntent(message: string): { days: number } | null {
  const normalized = message.trim().toLowerCase();
  if (!normalized) return null;

  const asksForUpdate =
    normalized.includes("aggiorn") ||
    normalized.includes("ultimi") ||
    normalized.includes("scorsi") ||
    normalized.includes("recent");

  const mentionsEvents =
    normalized.includes("evento") ||
    normalized.includes("eventi") ||
    normalized.includes("calendario") ||
    normalized.includes("appuntament");

  if (!asksForUpdate || !mentionsEvents) return null;

  const daysMatch = normalized.match(/(\d+)\s*giorn/);
  const days = daysMatch ? Number(daysMatch[1]) : 7;

  if (!Number.isFinite(days) || days <= 0) {
    return { days: 7 };
  }

  return { days: Math.min(days, 30) };
}

export async function loadRecentEventsSummary(args: {
  auth: AuthContext;
  days: number;
}): Promise<RecentEventsSummary> {
  const now = new Date();
  const from = new Date(now);
  from.setDate(from.getDate() - args.days);

  const types = getEventiList();

  const results = await Promise.all(
    types.map(async (typeDef) => {
      const { items } = await listEventi({
        type: typeDef.slug,
        timeFrom: from.toISOString(),
        timeTo: now.toISOString(),
        page: 1,
        pageSize: 5,
        auth: args.auth,
      });

      return items.map((item) => ({
        ...item,
        type: typeDef.slug,
        label: typeDef.label,
      }));
    }),
  );

  const items = results
    .flat()
    .sort((a, b) => {
      const aTs = a.startAt ? new Date(a.startAt).getTime() : 0;
      const bTs = b.startAt ? new Date(b.startAt).getTime() : 0;
      return bTs - aTs;
    })
    .slice(0, 12);

  return {
    days: args.days,
    total: items.length,
    items,
  };
}

export function buildRecentEventsReply(summary: RecentEventsSummary): string {
  if (!summary.total) {
    return `Negli ultimi ${summary.days} giorni non risultano eventi visibili nel tuo perimetro.`;
  }

  const lines = summary.items.map((item) => {
    const when = item.startAt
      ? new Date(item.startAt).toLocaleString("it-IT", {
          dateStyle: "short",
          timeStyle: "short",
        })
      : "senza data";

    return `- [${item.label}] ${item.displayName} (${when})`;
  });

  return [
    `Ti aggiorno sugli eventi visibili degli ultimi ${summary.days} giorni.`,
    lines.join("\n"),
    "Se vuoi, nel prossimo messaggio posso anche filtrare per tipo evento o preparare una creazione guidata.",
  ].join("\n\n");
}
