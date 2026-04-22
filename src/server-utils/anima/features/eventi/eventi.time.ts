import { ANIMA_RUNTIME_CONFIG } from "@/server-utils/anima/config/anima.runtime.config";

type ParsedTimeWindow = {
  startAt?: string;
  endAt?: string | null;
  timeKind?: "point" | "interval";
  missingDate?: boolean;
  invalidInterval?: boolean;
  startHour?: number;
  startMinute?: number;
  endHour?: number;
  endMinute?: number;
};

const WEEKDAYS = [
  "domenica",
  "lunedi",
  "martedi",
  "mercoledi",
  "giovedi",
  "venerdi",
  "sabato",
] as const;

const MONTHS = [
  "gennaio",
  "febbraio",
  "marzo",
  "aprile",
  "maggio",
  "giugno",
  "luglio",
  "agosto",
  "settembre",
  "ottobre",
  "novembre",
  "dicembre",
] as const;

const ITALIAN_NUMBER_WORDS: Record<string, number> = {
  uno: 1,
  una: 1,
  due: 2,
  tre: 3,
  quattro: 4,
  cinque: 5,
  sei: 6,
  sette: 7,
  otto: 8,
  nove: 9,
  dieci: 10,
  quattordici: 14,
  quindici: 15,
  trenta: 30,
};

function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w\s:./-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function startOfDay(date: Date) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function parseDayReference(normalized: string, now: Date): Date | null {
  if (normalized.includes("oggi")) return startOfDay(now);
  if (normalized.includes("domani")) {
    const next = startOfDay(now);
    next.setDate(next.getDate() + 1);
    return next;
  }
  if (normalized.includes("ieri")) {
    const next = startOfDay(now);
    next.setDate(next.getDate() - 1);
    return next;
  }

  const explicitDate = normalized.match(/\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/);
  if (explicitDate) {
    const day = Number(explicitDate[1]);
    const month = Number(explicitDate[2]) - 1;
    const yearRaw = explicitDate[3];
    const year = yearRaw
      ? Number(yearRaw.length === 2 ? `20${yearRaw}` : yearRaw)
      : now.getFullYear();
    return startOfDay(new Date(year, month, day));
  }

  for (let index = 0; index < WEEKDAYS.length; index++) {
    if (!normalized.includes(WEEKDAYS[index])) continue;

    const current = startOfDay(now);
    const delta = (index - current.getDay() + 7) % 7 || 7;
    current.setDate(current.getDate() + delta);
    return current;
  }

  return null;
}

function parseMonthReference(normalized: string, now: Date): {
  from: Date;
  to: Date;
} | null {
  if (normalized.includes("questo mese")) {
    const from = new Date(now.getFullYear(), now.getMonth(), 1);
    const to = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    return { from, to };
  }

  for (let index = 0; index < MONTHS.length; index++) {
    if (!normalized.includes(MONTHS[index])) continue;
    const year = index < now.getMonth() ? now.getFullYear() + 1 : now.getFullYear();
    const from = new Date(year, index, 1);
    const to = new Date(year, index + 1, 0, 23, 59, 59, 999);
    return { from, to };
  }

  return null;
}

function parseHourMinutePair(source: string): { hour: number; minute: number } | null {
  const pair = source.match(/\b(\d{1,2})(?:[:.](\d{2}))?\b/);
  if (!pair) return null;

  return {
    hour: Number(pair[1]),
    minute: Number(pair[2] ?? "0"),
  };
}

function parseWindowCount(value?: string): number | undefined {
  if (!value) return undefined;
  const normalized = normalizeText(value);
  const numeric = Number(normalized);
  if (Number.isFinite(numeric) && numeric > 0) {
    return numeric;
  }

  return ITALIAN_NUMBER_WORDS[normalized];
}

export function hasInvalidIntervalRange(args: {
  startAt?: string | null;
  endAt?: string | null;
  timeKind?: string | null;
}): boolean {
  if (args.timeKind !== "interval" || !args.startAt || !args.endAt) {
    return false;
  }

  const start = new Date(args.startAt);
  const end = new Date(args.endAt);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return false;
  }

  return end <= start;
}

export function parseCreateTimeWindow(message: string, now = new Date()): ParsedTimeWindow {
  const normalized = normalizeText(message);
  const dateRef = parseDayReference(normalized, now);

  const interval = normalized.match(
    /\bdalle\s+(\d{1,2})(?:[:.](\d{2}))?\s+(?:alle|fino alle|fino a)\s+(\d{1,2})(?:[:.](\d{2}))?\b/,
  );
  const compactInterval =
    interval ??
    normalized.match(/\b(?:orario\s+)?(\d{1,2})(?:[:.](\d{2}))?\s*[-/]\s*(\d{1,2})(?:[:.](\d{2}))?\b/);
  const looseInterval =
    compactInterval ??
    normalized.match(
      /\balle\s+(\d{1,2})(?:[:.](\d{2}))?\s+(?:fino alle|fino a)\s+(\d{1,2})(?:[:.](\d{2}))?\b/,
    );

  if (looseInterval && dateRef) {
    const startHour = Number(looseInterval[1]);
    const startMinute = Number(looseInterval[2] ?? "0");
    const endHour = Number(looseInterval[3]);
    const endMinute = Number(looseInterval[4] ?? "0");

    const start = new Date(dateRef);
    start.setHours(startHour, startMinute, 0, 0);

    const end = new Date(dateRef);
    end.setHours(endHour, endMinute, 0, 0);

    return {
      startAt: start.toISOString(),
      endAt: end.toISOString(),
      timeKind: "interval",
      invalidInterval: end <= start,
      startHour,
      startMinute,
      endHour,
      endMinute,
    };
  }

  const atTime = normalized.match(/\balle\s+(\d{1,2})(?:[:.](\d{2}))?\b/);
  if (atTime && dateRef) {
    const startHour = Number(atTime[1]);
    const startMinute = Number(atTime[2] ?? "0");
    const start = new Date(dateRef);
    start.setHours(startHour, startMinute, 0, 0);
    return {
      startAt: start.toISOString(),
      endAt: null,
      timeKind: "point",
      startHour,
      startMinute,
    };
  }

  if (dateRef) {
    const start = new Date(dateRef);
    start.setHours(9, 0, 0, 0);
    return {
      startAt: start.toISOString(),
      endAt: null,
      timeKind: "point",
    };
  }

  if (looseInterval) {
    return {
      missingDate: true,
      timeKind: "interval",
      startHour: Number(looseInterval[1]),
      startMinute: Number(looseInterval[2] ?? "0"),
      endHour: Number(looseInterval[3]),
      endMinute: Number(looseInterval[4] ?? "0"),
    };
  }

  if (atTime) {
    return {
      missingDate: true,
      timeKind: "point",
      startHour: Number(atTime[1]),
      startMinute: Number(atTime[2] ?? "0"),
    };
  }

  return {};
}

export function parseListRange(message: string, now = new Date()): {
  days?: number;
  futureDays?: number;
  specificDate?: string;
  monthFrom?: string;
  monthTo?: string;
} {
  const normalized = normalizeText(message);
  const futureExplicit =
    normalized.match(/prossim[ioe]\s+(\d+)\s+giorn/) ??
    normalized.match(
      /\bprossim[ioe]\s+(uno|una|due|tre|quattro|cinque|sei|sette|otto|nove|dieci|quattordici|quindici|trenta)\s+giorn/,
    );
  const futureCount = parseWindowCount(futureExplicit?.[1]);
  if (futureCount) {
    return {
      futureDays: Math.min(
        Math.max(futureCount, 1),
        ANIMA_RUNTIME_CONFIG.defaults.maxWindowDays,
      ),
    };
  }

  if (
    normalized.includes("prossima settimana") ||
    normalized.includes("prossimi sette giorni")
  ) {
    return { futureDays: 7 };
  }

  if (normalized.includes("prossimo mese")) {
    return { futureDays: 30 };
  }

  if (
    normalized.includes("programmati") ||
    normalized.includes("programmato") ||
    normalized.includes("in programma") ||
    normalized.includes("pianificati") ||
    normalized.includes("pianificato")
  ) {
    return { futureDays: ANIMA_RUNTIME_CONFIG.defaults.genericFutureDays };
  }

  if (
    ANIMA_RUNTIME_CONFIG.routing.genericFutureTerms.some((term) =>
      normalized.includes(term),
    )
  ) {
    return { futureDays: ANIMA_RUNTIME_CONFIG.defaults.genericFutureDays };
  }

  const explicit =
    normalized.match(/ultim[i|e]\s+(\d+)\s+giorn/) ??
    normalized.match(
      /\bultim[i|e]\s+(uno|una|due|tre|quattro|cinque|sei|sette|otto|nove|dieci|quattordici|quindici|trenta)\s+giorn/,
    );
  const daysCount = parseWindowCount(explicit?.[1]);
  if (daysCount) {
    return {
      days: Math.min(
        Math.max(daysCount, 1),
        ANIMA_RUNTIME_CONFIG.defaults.maxWindowDays,
      ),
    };
  }

  if (normalized.includes("ultima settimana") || normalized.includes("ultimi sette giorni")) {
    return { days: 7 };
  }

  if (
    normalized.includes("settimana passata") ||
    normalized.includes("settimana scorsa") ||
    normalized.includes("settimana appena trascorsa") ||
    normalized.includes("settimana trascorsa")
  ) {
    return { days: 7 };
  }

  if (normalized.includes("ultimo mese")) {
    return { days: 30 };
  }

  const dateRef = parseDayReference(normalized, now);
  if (dateRef) {
    return { specificDate: dateRef.toISOString().slice(0, 10) };
  }

  const monthRef = parseMonthReference(normalized, now);
  if (monthRef) {
    return {
      monthFrom: monthRef.from.toISOString(),
      monthTo: monthRef.to.toISOString(),
    };
  }

  return {};
}

export function parseRawTitle(message: string): string | undefined {
  const quoted =
    message.match(/titolo\s*[:=]\s*"([^"]+)"/i) ||
    message.match(/titolo\s*[:=]\s*'([^']+)'/i) ||
    message.match(/titolo\s+"([^"]+)"/i) ||
    message.match(/titolo\s+'([^']+)'/i);
  if (quoted?.[1]?.trim()) return quoted[1].trim();

  const loose =
    message.match(/titolo\s*[:=]\s*([^.!\n]+)/i) ||
    message.match(/titolo\s+([^.!\n]+)/i);
  if (loose?.[1]?.trim()) return loose[1].trim();

  return undefined;
}

export function parseRawNotes(message: string): string | undefined {
  const quoted =
    message.match(/note\s*[:=]\s*"([^"]+)"/i) ||
    message.match(/note\s*[:=]\s*'([^']+)'/i);
  if (quoted?.[1]?.trim()) return quoted[1].trim();

  const loose = message.match(/note\s*[:=]\s*([^.!\n]+)/i);
  if (loose?.[1]?.trim()) return loose[1].trim();

  return undefined;
}
