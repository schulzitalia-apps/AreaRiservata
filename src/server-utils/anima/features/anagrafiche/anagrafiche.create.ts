import { getAnagraficaDef, getAnagraficheList } from "@/config/anagrafiche.registry";
import type { FieldKey } from "@/config/anagrafiche.fields.catalog";
import type { AuthContext } from "@/server-utils/lib/auth-context";
import { createAnagrafica } from "@/server-utils/service/Anagrafiche";
import type { PendingAnagraficheCreateState } from "@/server-utils/anima/memory/sessionState";
import type { AnagraficheCreateOperationContextFillResult } from "@/server-utils/anima/nodes/operationContextFiller";
import type { AnagraficheCreateIntent, AnagraficheCreateQuery } from "./anagrafiche.types";

type TypeDescriptor = {
  slug: string;
  label: string;
  aliases: string[];
};

export type AnagraficheCreateClarification = {
  needsClarification: boolean;
  missing: string[];
};

export type AnagraficheCreateExecution =
  | {
      kind: "result";
      result: {
        text: string;
        createdId: string;
        typeSlug: string;
        typeLabel: string;
        summaryLines: string[];
      };
    }
  | {
      kind: "clarification";
      phase: "collect_type" | "collect_data" | "confirm_write";
      missing: string[];
      question: string;
      data: PendingAnagraficheCreateState["data"];
      extractedThisTurn?: Record<string, unknown> | null;
    }
  | {
      kind: "denied";
      text: string;
      reason: string;
    };

function normalizeText(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/['’]/g, " ")
    .replace(/[^\w\s-]/g, " ")
    .replace(/_/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function uniqueStrings(values: Array<string | null | undefined>) {
  return Array.from(
    new Set(values.map((value) => String(value ?? "").trim()).filter(Boolean)),
  );
}

function getTypeDescriptors(): TypeDescriptor[] {
  return getAnagraficheList().map((typeDef) => {
    const normalizedLabel = normalizeText(typeDef.label);
    const normalizedSlug = normalizeText(typeDef.slug.replace(/-/g, " "));
    const aliases = uniqueStrings([
      normalizedLabel,
      normalizedSlug,
      ...normalizedLabel.split(" ").map((token) => token.slice(0, -1)),
      ...normalizedSlug.split(" ").map((token) => token.slice(0, -1)),
    ]).filter((token) => token.length >= 3);

    return {
      slug: typeDef.slug,
      label: typeDef.label,
      aliases,
    };
  });
}

function resolveTypeFromMessage(message: string): {
  slug: string;
  label: string;
} | null {
  const normalized = normalizeText(message);
  let bestMatch: { slug: string; label: string; score: number } | null = null;

  for (const type of getTypeDescriptors()) {
    let score = 0;
    for (const alias of type.aliases) {
      if (!alias) continue;
      if (normalized.includes(alias)) {
        score = Math.max(score, alias.length);
      }
    }

    if (!score) continue;
    if (!bestMatch || score > bestMatch.score) {
      bestMatch = { slug: type.slug, label: type.label, score };
    }
  }

  return bestMatch
    ? { slug: bestMatch.slug, label: bestMatch.label }
    : null;
}

function hasCreateVerb(message: string) {
  const normalized = normalizeText(message);
  return (
    normalized.includes("crea") ||
    normalized.includes("creami") ||
    normalized.includes("aggiungi") ||
    normalized.includes("inserisci") ||
    normalized.includes("registra") ||
    normalized.includes("nuov") ||
    normalized.includes("apri una scheda")
  );
}

function mentionsAnagraficheDomain(message: string) {
  const normalized = normalizeText(message);
  return (
    !!resolveTypeFromMessage(message) ||
    normalized.includes("anagrafica") ||
    normalized.includes("anagrafiche") ||
    normalized.includes("scheda") ||
    normalized.includes("record")
  );
}

function isPositiveConfirmation(message: string) {
  const normalized = normalizeText(message);
  return (
    normalized === "si" ||
    normalized === "sì" ||
    normalized === "ok" ||
    normalized === "va bene" ||
    normalized === "va bene cosi" ||
    normalized === "va bene così" ||
    normalized.includes("va bene cosi") ||
    normalized.includes("va bene così") ||
    normalized === "procedi" ||
    normalized === "conferma" ||
    normalized === "vai"
  );
}

function getSuggestedFieldKeys(typeSlug?: string | null): FieldKey[] {
  if (!typeSlug) return [];
  const typeDef = getAnagraficaDef(typeSlug);
  const candidates = [
    ...typeDef.preview.title,
    ...typeDef.preview.subtitle,
    ...typeDef.preview.searchIn,
    ...(Object.keys(typeDef.fields) as FieldKey[]),
  ];

  return candidates.filter(
    (fieldKey, index, array) => array.indexOf(fieldKey) === index,
  );
}

function getFundamentalFieldKeys(typeSlug?: string | null): FieldKey[] {
  if (!typeSlug) return [];
  const typeDef = getAnagraficaDef(typeSlug);
  return typeDef.preview.title.filter(
    (fieldKey, index, array) =>
      array.indexOf(fieldKey) === index && !!typeDef.fields[fieldKey],
  );
}

function getMissingFundamentalFieldKeys(args: {
  typeSlug?: string | null;
  draftData?: Record<string, unknown> | null;
}): FieldKey[] {
  const draftData = args.draftData ?? {};
  return getFundamentalFieldKeys(args.typeSlug).filter((fieldKey) => {
    const value = draftData[fieldKey];
    if (value === null || typeof value === "undefined") return true;
    if (typeof value === "string" && !value.trim()) return true;
    if (Array.isArray(value) && !value.length) return true;
    return false;
  });
}

function getOptionalFieldKeys(args: {
  typeSlug?: string | null;
  draftData?: Record<string, unknown> | null;
}): FieldKey[] {
  const draftData = args.draftData ?? {};
  return getSuggestedFieldKeys(args.typeSlug).filter((fieldKey) => {
    const value = draftData[fieldKey];
    if (value === null || typeof value === "undefined") return true;
    if (typeof value === "string" && !value.trim()) return true;
    if (Array.isArray(value) && !value.length) return true;
    return false;
  });
}

function sanitizeDraftData(args: {
  typeSlug?: string | null;
  draftData?: Record<string, unknown> | null;
}) {
  if (!args.typeSlug || !args.draftData) return {};
  const typeDef = getAnagraficaDef(args.typeSlug);

  return Object.fromEntries(
    Object.entries(args.draftData).filter(([fieldKey, value]) => {
      if (!typeDef.fields[fieldKey as FieldKey]) return false;
      if (value === null || typeof value === "undefined") return false;
      if (typeof value === "string" && !value.trim()) return false;
      if (Array.isArray(value) && !value.length) return false;
      return true;
    }),
  );
}

function formatFieldValue(value: unknown): string | null {
  if (value === null || typeof value === "undefined") return null;
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed || null;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (Array.isArray(value)) {
    const rendered = value
      .map((item) => formatFieldValue(item))
      .filter(Boolean)
      .join(", ");
    return rendered || null;
  }
  if (typeof value === "object") {
    return JSON.stringify(value);
  }
  return String(value);
}

function buildSummaryLines(args: {
  typeSlug: string;
  draftData: Record<string, unknown>;
}) {
  const typeDef = getAnagraficaDef(args.typeSlug);
  return Object.entries(args.draftData)
    .map(([fieldKey, value]) => {
      const fieldDef = typeDef.fields[fieldKey as FieldKey];
      const renderedValue = formatFieldValue(value);
      if (!fieldDef || !renderedValue) return null;
      return `${fieldDef.label}: ${renderedValue}`;
    })
    .filter(Boolean) as string[];
}

function extractDeterministicDraftData(typeSlug: string, message: string) {
  const normalized = normalizeText(message);
  const typeDef = getAnagraficaDef(typeSlug);
  const primaryFieldKey =
    typeDef.preview.title[0] ?? (Object.keys(typeDef.fields)[0] as FieldKey | undefined);
  if (!primaryFieldKey) return {};

  const namedMatch =
    message.match(/\b(?:chiamat[oa]|nome|ragione sociale)\s+(.+)$/i) ??
    message.match(/["“](.+?)["”]/);

  if (!namedMatch?.[1]) return {};
  const value = namedMatch[1].trim();
  if (!value || normalizeText(value) === normalized) return {};

  return {
    [primaryFieldKey]: value,
  };
}

export function parseAnagraficheCreateIntent(
  message: string,
): AnagraficheCreateIntent | null {
  if (!hasCreateVerb(message) || !mentionsAnagraficheDomain(message)) {
    return null;
  }

  const resolvedType = resolveTypeFromMessage(message);
  const draftData = resolvedType
    ? extractDeterministicDraftData(resolvedType.slug, message)
    : {};

  return {
    type: "anagrafiche_create",
    query: {
      typeSlug: resolvedType?.slug ?? null,
      typeLabel: resolvedType?.label ?? null,
      draftData,
      suggestedFields: getSuggestedFieldKeys(resolvedType?.slug ?? null),
      confirmWrite: false,
    },
    explanation: resolvedType
      ? `Creazione anagrafica sul tipo ${resolvedType.label}.`
      : "Creazione anagrafica da completare.",
    debug: {
      matchedBy: resolvedType
        ? "anagrafiche_create:type_match"
        : "anagrafiche_create:generic",
    },
  };
}

export function mergePendingAnagraficheCreateIntent(args: {
  pending: PendingAnagraficheCreateState;
  message: string;
}): AnagraficheCreateIntent {
  const parsed = parseAnagraficheCreateIntent(args.message);
  const resolvedType = parsed?.query.typeSlug
    ? {
        slug: parsed.query.typeSlug,
        label: parsed.query.typeLabel ?? args.pending.data.typeLabel ?? "",
      }
    : resolveTypeFromMessage(args.message);

  return {
    type: "anagrafiche_create",
    query: {
      typeSlug:
        resolvedType?.slug ?? parsed?.query.typeSlug ?? args.pending.data.typeSlug ?? null,
      typeLabel:
        resolvedType?.label ?? parsed?.query.typeLabel ?? args.pending.data.typeLabel ?? null,
      draftData: sanitizeDraftData({
        typeSlug:
          resolvedType?.slug ?? parsed?.query.typeSlug ?? args.pending.data.typeSlug ?? null,
        draftData: {
          ...(args.pending.data.draftData ?? {}),
          ...(parsed?.query.draftData ?? {}),
        },
      }),
      suggestedFields: getSuggestedFieldKeys(
        resolvedType?.slug ?? parsed?.query.typeSlug ?? args.pending.data.typeSlug ?? null,
      ),
      confirmWrite:
        parsed?.query.confirmWrite ??
        args.pending.data.confirmWrite ??
        isPositiveConfirmation(args.message),
    },
    explanation: "Creazione anagrafica aggiornata dal contesto pending.",
    debug: {
      matchedBy: parsed?.debug.matchedBy ?? "anagrafiche_create:pending_merge",
    },
  };
}

export function mergeAnagraficheCreateIntentWithFill(args: {
  intent: AnagraficheCreateIntent | null;
  pending: PendingAnagraficheCreateState | null;
  fill: AnagraficheCreateOperationContextFillResult | null;
  message: string;
}): AnagraficheCreateIntent | null {
  const baseIntent =
    args.pending && !args.intent
      ? mergePendingAnagraficheCreateIntent({
          pending: args.pending,
          message: args.message,
        })
      : args.intent;

  if (!baseIntent && !args.pending && !args.fill) {
    return null;
  }

  const resolvedTypeFromFill =
    args.fill?.payloadPatch.typeSlug && args.fill?.payloadPatch.typeLabel
      ? {
          slug: args.fill.payloadPatch.typeSlug,
          label: args.fill.payloadPatch.typeLabel,
        }
      : typeof args.fill?.payloadPatch.typeText === "string" &&
          args.fill.payloadPatch.typeText.trim()
        ? resolveTypeFromMessage(args.fill.payloadPatch.typeText.trim())
        : null;

  const effectiveTypeSlug =
    resolvedTypeFromFill?.slug ??
    baseIntent?.query.typeSlug ??
    args.pending?.data.typeSlug ??
    null;
  const effectiveTypeLabel =
    resolvedTypeFromFill?.label ??
    baseIntent?.query.typeLabel ??
    args.pending?.data.typeLabel ??
    null;

  const draftData = sanitizeDraftData({
    typeSlug: effectiveTypeSlug,
    draftData: {
      ...(args.pending?.data.draftData ?? {}),
      ...(baseIntent?.query.draftData ?? {}),
      ...(args.fill?.payloadPatch.draftData ?? {}),
    },
  });

  return {
    type: "anagrafiche_create",
    query: {
      typeSlug: effectiveTypeSlug,
      typeLabel: effectiveTypeLabel,
      draftData,
      suggestedFields: getSuggestedFieldKeys(effectiveTypeSlug),
      confirmWrite:
        args.fill?.payloadPatch.confirmWrite ??
        baseIntent?.query.confirmWrite ??
        args.pending?.data.confirmWrite ??
        isPositiveConfirmation(args.message),
    },
    explanation:
      baseIntent?.explanation ??
      "Intent di creazione anagrafica ricostruito dal contesto conversazionale.",
    debug: {
      matchedBy: args.fill
        ? "anagrafiche_create.fill"
        : (baseIntent?.debug.matchedBy ?? "anagrafiche_create.pending"),
    },
  };
}

export function analyzeAnagraficheCreateIntent(
  intent: AnagraficheCreateIntent,
): AnagraficheCreateClarification {
  const missing: string[] = [];
  if (!intent.query.typeSlug) {
    missing.push("type");
  }

  const missingFundamentalFields = getMissingFundamentalFieldKeys({
    typeSlug: intent.query.typeSlug,
    draftData: intent.query.draftData ?? {},
  });
  if (intent.query.typeSlug && missingFundamentalFields.length > 0) {
    missing.push("data");
  }

  return {
    needsClarification: missing.length > 0,
    missing,
  };
}

export function buildAnagraficheCreateQuestion(args: {
  missing: string[];
  currentQuery: AnagraficheCreateQuery;
}): string {
  const missingKey = args.missing[0];
  if (missingKey === "type") {
    const labels = getAnagraficheList()
      .slice(0, 6)
      .map((typeDef) => typeDef.label)
      .join(", ");
    return `Dimmi prima che tipo di anagrafica vuoi creare. Per esempio: ${labels}.`;
  }

  if (missingKey === "data" && args.currentQuery.typeSlug) {
    const typeDef = getAnagraficaDef(args.currentQuery.typeSlug);
    const draftData = args.currentQuery.draftData ?? {};
    const missingFundamentalFields = getMissingFundamentalFieldKeys({
      typeSlug: args.currentQuery.typeSlug,
      draftData,
    });
    const optionalFieldKeys = getOptionalFieldKeys({
      typeSlug: args.currentQuery.typeSlug,
      draftData,
    });
    const missingLabels = missingFundamentalFields
      .map((fieldKey) => typeDef.fields[fieldKey]?.label ?? fieldKey)
      .join(", ");
    const optionalLabels = optionalFieldKeys
      .slice(0, 6)
      .map((fieldKey) => typeDef.fields[fieldKey]?.label ?? fieldKey)
      .join(", ");
    const filledSummary = buildSummaryLines({
      typeSlug: args.currentQuery.typeSlug,
      draftData,
    }).slice(0, 4);
    const filledText = filledSummary.length
      ? ` Ho già preso: ${filledSummary.join(" | ")}.`
      : "";
    const optionalText = optionalLabels
      ? ` Poi, se vuoi, puoi aggiungere anche: ${optionalLabels}.`
      : "";
    return `Perfetto, creo in ${typeDef.label}. Per salvarla bene mi servono ancora questi fondamentali: ${missingLabels}.${filledText}${optionalText}`;
  }

  if (missingKey === "confirm" && args.currentQuery.typeSlug) {
    const typeDef = getAnagraficaDef(args.currentQuery.typeSlug);
    const summaryLines = buildSummaryLines({
      typeSlug: args.currentQuery.typeSlug,
      draftData: args.currentQuery.draftData ?? {},
    });
    const optionalFieldKeys = getOptionalFieldKeys({
      typeSlug: args.currentQuery.typeSlug,
      draftData: args.currentQuery.draftData ?? {},
    });
    const summary =
      summaryLines.length > 0 ? ` ${summaryLines.join(" | ")}.` : "";
    const optionalText = optionalFieldKeys.length
      ? ` Se vuoi puoi aggiungere ancora ${optionalFieldKeys
          .slice(0, 4)
          .map((fieldKey) => typeDef.fields[fieldKey]?.label ?? fieldKey)
          .join(", ")}, oppure dirmi "va bene così".`
      : ` Se per te va bene così, dimmelo e procedo.`;
    return `Sto per creare la nuova scheda in ${args.currentQuery.typeLabel}.${summary}${optionalText}`;
  }

  return "Mi aiuti a completare l'ultimo dettaglio utile prima di creare la scheda?";
}

function canCreateAnagrafiche(auth: AuthContext) {
  return auth.isAdmin || auth.role !== "Cliente";
}

export async function executeAnagraficheCreateIntent(args: {
  auth: AuthContext;
  query: AnagraficheCreateQuery;
}): Promise<AnagraficheCreateExecution> {
  if (!args.query.typeSlug) {
    return {
      kind: "clarification",
      phase: "collect_type",
      missing: ["type"],
      question: buildAnagraficheCreateQuestion({
        missing: ["type"],
        currentQuery: args.query,
      }),
      data: {
        typeSlug: null,
        typeLabel: null,
        draftData: args.query.draftData ?? {},
        suggestedFields: [],
        confirmWrite: false,
      },
    };
  }

  const typeDef = getAnagraficaDef(args.query.typeSlug);
  const draftData = sanitizeDraftData({
    typeSlug: args.query.typeSlug,
    draftData: args.query.draftData ?? {},
  });
  const missingFundamentalFields = getMissingFundamentalFieldKeys({
    typeSlug: args.query.typeSlug,
    draftData,
  });

  if (missingFundamentalFields.length > 0) {
    return {
      kind: "clarification",
      phase: "collect_data",
      missing: ["data"],
      question: buildAnagraficheCreateQuestion({
        missing: ["data"],
        currentQuery: {
          ...args.query,
          typeLabel: typeDef.label,
          draftData,
        },
      }),
      data: {
        typeSlug: args.query.typeSlug,
        typeLabel: typeDef.label,
        draftData,
        suggestedFields: getSuggestedFieldKeys(args.query.typeSlug),
        confirmWrite: false,
      },
      extractedThisTurn: {
        typeSlug: args.query.typeSlug,
      },
    };
  }

  if (!canCreateAnagrafiche(args.auth)) {
    return {
      kind: "denied",
      text: `Posso aiutarti a preparare la scheda ${typeDef.label}, ma da qui non posso crearla con il tuo profilo attuale.`,
      reason: "anagrafiche_create_permission_denied",
    };
  }

  if (!args.query.confirmWrite) {
    return {
      kind: "clarification",
      phase: "confirm_write",
      missing: ["confirm"],
      question: buildAnagraficheCreateQuestion({
        missing: ["confirm"],
        currentQuery: {
          ...args.query,
          typeLabel: typeDef.label,
          draftData,
        },
      }),
      data: {
        typeSlug: args.query.typeSlug,
        typeLabel: typeDef.label,
        draftData,
        suggestedFields: getSuggestedFieldKeys(args.query.typeSlug),
        confirmWrite: false,
      },
      extractedThisTurn: {
        typeSlug: args.query.typeSlug,
        draftData,
      },
    };
  }

  const created = await createAnagrafica({
    type: args.query.typeSlug,
    userId: args.auth.userId,
    data: draftData,
  });

  const summaryLines = buildSummaryLines({
    typeSlug: args.query.typeSlug,
    draftData,
  });
  const text =
    summaryLines.length > 0
      ? `Ho creato la nuova scheda in ${typeDef.label}.\n${summaryLines
          .map((line) => `- ${line}`)
          .join("\n")}`
      : `Ho creato la nuova scheda in ${typeDef.label}.`;

  return {
    kind: "result",
    result: {
      text,
      createdId: created.id,
      typeSlug: args.query.typeSlug,
      typeLabel: typeDef.label,
      summaryLines,
    },
  };
}
