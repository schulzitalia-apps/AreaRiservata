import { getAnagraficaDef, getAnagraficheList } from "@/config/anagrafiche.registry";
import type { FieldKey } from "@/config/anagrafiche.fields.catalog";
import type { AuthContext } from "@/server-utils/lib/auth-context";
import { listAnagrafiche } from "@/server-utils/service/Anagrafiche/list";
import type { PendingAnagraficheReadState } from "@/server-utils/anima/memory/sessionState";
import type { AnagraficheReadOperationContextFillResult } from "@/server-utils/anima/nodes/operationContextFiller";
import type {
  AnagraficheCandidateRecord,
  AnagraficheListingPresentation,
  AnagraficheReadIntent,
  AnagraficheReadQuery,
  AnagraficheReadResult,
  AnagraficheRecordSnapshot,
} from "./anagrafiche.types";

type TypeDescriptor = {
  slug: string;
  label: string;
  aliases: string[];
};

export type AnagraficheReadClarification = {
  needsClarification: boolean;
  missing: string[];
};

export type AnagraficheReadExecution =
  | {
      kind: "result";
      result: AnagraficheReadResult;
    }
  | {
      kind: "clarification";
      phase:
        | "collect_type"
        | "collect_query"
        | "collect_record"
        | "collect_fields";
      missing: string[];
      question: string;
      data: PendingAnagraficheReadState["data"];
      extractedThisTurn?: Record<string, unknown> | null;
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

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function containsWholeAlias(message: string, alias: string) {
  if (!alias) return false;
  const pattern = new RegExp(`(?:^|\\s)${escapeRegExp(alias)}(?:$|\\s)`, "i");
  return pattern.test(` ${message} `);
}

function uniqueStrings(values: Array<string | null | undefined>) {
  return Array.from(
    new Set(values.map((value) => String(value ?? "").trim()).filter(Boolean)),
  );
}

function buildAliasVariants(token: string) {
  const normalized = normalizeText(token);
  if (!normalized) return [];

  const variants = new Set<string>([normalized]);
  if (normalized.endsWith("i") && normalized.length >= 4) {
    variants.add(`${normalized.slice(0, -1)}e`);
    variants.add(`${normalized.slice(0, -1)}o`);
  }
  if (normalized.endsWith("e") && normalized.length >= 4) {
    variants.add(`${normalized.slice(0, -1)}a`);
    variants.add(`${normalized.slice(0, -1)}o`);
  }
  if (normalized.endsWith("ori") && normalized.length >= 5) {
    variants.add(`${normalized.slice(0, -1)}e`);
  }

  return [...variants];
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
      ...normalizedLabel.split(" ").flatMap(buildAliasVariants),
      ...normalizedSlug.split(" ").flatMap(buildAliasVariants),
    ]).filter((token) => token.length >= 3);

    return {
      slug: typeDef.slug,
      label: typeDef.label,
      aliases,
    };
  });
}

function getGenericSearchTerms() {
  return [
    "anagrafica",
    "anagrafiche",
    "scheda",
    "schede",
    "record",
    "records",
    "campo",
    "campi",
    "dati",
    "dato",
    "trova",
    "trovami",
    "cerca",
    "cercami",
    "mostra",
    "mostrami",
    "dammi",
    "fammi vedere",
    "lista",
    "elenco",
    "leggi",
    "leggimi",
  ];
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
      if (containsWholeAlias(normalized, alias)) {
        score = Math.max(score, alias.split(" ").length * 10 + alias.length);
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

function mentionsAnagrafiche(message: string) {
  const normalized = normalizeText(message);
  if (looksLikeSprintTimelineTaskRequest(normalized)) return false;
  if (looksLikeEventDomainRequest(normalized) && !hasExplicitAnagraficheDomainRequest(normalized)) {
    return false;
  }
  if (resolveTypeFromMessage(normalized)) return true;
  return getGenericSearchTerms().some((term) => normalized.includes(term));
}

function hasExplicitAnagraficheDomainRequest(normalizedMessage: string) {
  return (
    normalizedMessage.includes("anagrafic") ||
    normalizedMessage.includes("fornitor") ||
    normalizedMessage.includes("client") ||
    normalizedMessage.includes("ent") ||
    normalizedMessage.includes("preventiv") ||
    normalizedMessage.includes("ricav") ||
    normalizedMessage.includes("articol") ||
    normalizedMessage.includes("serviz") ||
    normalizedMessage.includes("bando") ||
    normalizedMessage.includes("spes") ||
    normalizedMessage.includes("righe preventivo")
  );
}

function looksLikeEventDomainRequest(normalizedMessage: string) {
  const eventSignals = [
    "evento",
    "eventi",
    "appuntamento",
    "appuntamenti",
    "calendario",
    "agenda",
    "memo",
    "riunione",
    "arrivo merce",
    "ordine merce",
    "pagamento",
    "fattura",
    "arrivo",
    "merce",
    "scadenza abbonamento",
  ];

  return eventSignals.some((token) => normalizedMessage.includes(token));
}

function looksLikeSprintTimelineTaskRequest(normalizedMessage: string) {
  const explicitAnagraficheContext =
    normalizedMessage.includes("anagrafic") ||
    normalizedMessage.includes("scheda task") ||
    normalizedMessage.includes("record task") ||
    normalizedMessage.includes("campi task") ||
    normalizedMessage.includes("anagrafica task");
  if (explicitAnagraficheContext) return false;

  const managerSignals = [
    "chi sta facendo cosa",
    "chi fa cosa",
    "chi segue cosa",
    "chi sta seguendo",
    "siamo in ritardo",
    "cosa e in ritardo",
    "cosa è in ritardo",
    "cosa sta slittando",
    "cosa e a rischio",
    "cosa è a rischio",
    "quanti passaggi",
    "quanti checkpoint",
    "da quanti passaggi",
    "come e composto",
    "come è composto",
  ];
  if (managerSignals.some((token) => normalizedMessage.includes(token))) {
    return true;
  }

  const taskLexicon = [
    "task",
    "attivita",
    "compiti",
    "compito",
    "todo",
    "to do",
    "to-do",
    "da fare",
    "cose da fare",
    "cosa c e da fare",
    "cosa c'e da fare",
  ];
  const hasTaskWord = taskLexicon.some((token) =>
    normalizedMessage.includes(token),
  );
  const hasTimelineSignals =
    normalizedMessage.includes("futuri") ||
    normalizedMessage.includes("futuro") ||
    normalizedMessage.includes("prossimi giorni") ||
    normalizedMessage.includes("oggi") ||
    normalizedMessage.includes("domani") ||
    normalizedMessage.includes("scadenz") ||
    normalizedMessage.includes("priorita") ||
    normalizedMessage.includes("ho da fare") ||
    normalizedMessage.includes("cosa devo fare") ||
    normalizedMessage.includes("cosa ho da fare") ||
    normalizedMessage.includes("cose da fare") ||
    normalizedMessage.includes("da fare") ||
    normalizedMessage.includes("miei task") ||
    normalizedMessage.includes("mie task") ||
    normalizedMessage.includes("mie attivita") ||
    normalizedMessage.includes("miei compiti") ||
    normalizedMessage.includes("i miei compiti") ||
    normalizedMessage.includes("task attivi") ||
    normalizedMessage.includes("task aperti") ||
    normalizedMessage.includes("compiti attivi") ||
    normalizedMessage.includes("compiti aperti") ||
    normalizedMessage.includes("tutti i task") ||
    normalizedMessage.includes("tutte le attivita") ||
    normalizedMessage.includes("tutti i compiti");

  return hasTaskWord && hasTimelineSignals;
}

function parseRequestedFields(
  message: string,
  typeSlug?: string | null,
): FieldKey[] {
  if (!typeSlug) return [];

  const normalized = normalizeText(message);
  const typeDef = getAnagraficaDef(typeSlug);
  if (
    normalized.includes("tutti i campi") ||
    normalized.includes("tutto il record") ||
    normalized.includes("tutti i dati")
  ) {
    return [...typeDef.preview.title, ...typeDef.preview.subtitle, ...typeDef.preview.searchIn]
      .concat(Object.keys(typeDef.fields) as FieldKey[])
      .filter((value, index, array) => array.indexOf(value) === index);
  }

  return (Object.entries(typeDef.fields) as Array<[FieldKey, { label?: string; hint?: string }]>)
    .filter(([fieldKey, fieldDef]) => {
      const candidates = uniqueStrings([
        fieldKey,
        normalizeText(fieldDef.label ?? ""),
        normalizeText(fieldDef.hint ?? ""),
        ...normalizeText(fieldDef.label ?? "").split(" ").map((token) => token.slice(0, -1)),
      ]).filter((candidate) => candidate.length >= 3);
      return candidates.some((candidate) => normalized.includes(candidate));
    })
    .map(([fieldKey]) => fieldKey);
}

function getContactFieldKeys(typeSlug?: string | null): {
  emailFields: FieldKey[];
  phoneFields: FieldKey[];
} {
  if (!typeSlug) {
    return { emailFields: [], phoneFields: [] };
  }

  const typeDef = getAnagraficaDef(typeSlug);
  const entries = Object.entries(typeDef.fields) as Array<
    [FieldKey, { type?: string }]
  >;

  return {
    emailFields: entries
      .filter(([, fieldDef]) => fieldDef.type === "email")
      .map(([fieldKey]) => fieldKey),
    phoneFields: entries
      .filter(([, fieldDef]) => fieldDef.type === "tel")
      .map(([fieldKey]) => fieldKey),
  };
}

function parseListIntent(message: string) {
  const normalized = normalizeText(message);
  return (
    normalized.includes("lista") ||
    normalized.includes("elenco") ||
    normalized.includes("tutti") ||
    normalized.includes("tutte") ||
    normalized.includes("quali ")
  );
}

function stripTypeTerms(message: string, typeSlug?: string | null) {
  let working = normalizeText(message);
  for (const term of getGenericSearchTerms()) {
    working = working.replace(new RegExp(`\\b${term}\\b`, "g"), " ");
  }

  if (typeSlug) {
    const type = getTypeDescriptors().find((item) => item.slug === typeSlug);
    for (const alias of type?.aliases ?? []) {
      working = working.replace(new RegExp(`\\b${alias}\\b`, "g"), " ");
    }
  }

  return working
    .replace(
      /\b(vorrei|voglio|devo|devi|puoi|potresti|mi|me|a me|per me|sto|stavo|cercando|cercare|cerca|cercami|trovare|trova|trovami|mostra|mostrami|dimmi|fammi|vedere|indicami|dammi|tra|fra|nei|nelle|nel|nella|nei miei|nelle mie|i miei|le mie|miei|mie|mio|mia|nostri|nostre|nostro|nostra|di|del|della|dei|degli|delle|per|con|solo|su|il|lo|la|i|gli|le|un|una|uno)\b/g,
      " ",
    )
    .replace(/\b(tra i|tra le|nei miei|nelle mie|nei miei fornitori|nelle mie anagrafiche)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parseSearchQuery(args: {
  message: string;
  typeSlug?: string | null;
  requestedFields?: FieldKey[];
  wantsList?: boolean;
}): string | null {
  const normalized = normalizeText(args.message);
  const quotedMatch = args.message.match(/["“](.+?)["”]/);
  if (quotedMatch?.[1]) return quotedMatch[1].trim();

  let working = stripTypeTerms(args.message, args.typeSlug);
  for (const fieldKey of args.requestedFields ?? []) {
    working = working.replace(new RegExp(`\\b${normalizeText(fieldKey)}\\b`, "g"), " ");
  }

  working = working
    .replace(/\b(devi cercare|devi trovare|puoi cercare|puoi trovare|vorrei cercare|voglio cercare|tra i miei|tra le mie|nei miei|nelle mie|tra i|tra le)\b/g, " ")
    .replace(/\b(email|telefono|telefoni|pec|p iva|partita iva|ragione sociale|nome|codice|indirizzo|stato|referente|note)\b/g, " ")
    .replace(/\b(tutti|tutte)\b/g, args.wantsList ? " " : " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!working) return null;
  return working.length >= 2 ? working : null;
}

function findSelectedCandidate(
  message: string,
  candidates: AnagraficheCandidateRecord[],
): AnagraficheCandidateRecord | null {
  const normalized = normalizeText(message);
  if (!normalized) return null;

  const ordinalMap: Record<string, number> = {
    primo: 0,
    prima: 0,
    secondo: 1,
    seconda: 1,
    terzo: 2,
    terza: 2,
    quarto: 3,
    quarta: 3,
  };

  for (const [word, index] of Object.entries(ordinalMap)) {
    if (normalized.includes(word) && candidates[index]) {
      return candidates[index];
    }
  }

  const numericMatch = normalized.match(/\b([1-9])\b/);
  if (numericMatch?.[1]) {
    const index = Number(numericMatch[1]) - 1;
    if (candidates[index]) return candidates[index];
  }

  return (
    candidates.find((candidate) =>
      normalized.includes(normalizeText(candidate.displayName)),
    ) ?? null
  );
}

export function parseAnagraficheReadIntent(message: string): AnagraficheReadIntent | null {
  if (!mentionsAnagrafiche(message)) return null;
  if (
    looksLikeEventDomainRequest(normalizeText(message)) &&
    !hasExplicitAnagraficheDomainRequest(normalizeText(message))
  ) {
    return null;
  }

  const resolvedType = resolveTypeFromMessage(message);
  if (resolvedType?.slug === "task" && looksLikeSprintTimelineTaskRequest(normalizeText(message))) {
    return null;
  }
  const requestedFields = parseRequestedFields(message, resolvedType?.slug);
  const wantsList = parseListIntent(message);
  const query = parseSearchQuery({
    message,
    typeSlug: resolvedType?.slug,
    requestedFields,
    wantsList,
  });

  return {
    type: "anagrafiche_read",
    query: {
      typeSlug: resolvedType?.slug ?? null,
      typeLabel: resolvedType?.label ?? null,
      query,
      requestedFields,
      wantsList,
      selectedRecordId: null,
      selectedRecordLabel: null,
    },
    explanation: resolvedType
      ? `Ricerca anagrafica sul tipo ${resolvedType.label}.`
      : "Ricerca anagrafica da completare.",
    debug: {
      matchedBy: resolvedType ? "anagrafiche:type_match" : "anagrafiche:generic",
    },
  };
}

export function mergePendingAnagraficheReadIntent(args: {
  pending: PendingAnagraficheReadState;
  message: string;
}): AnagraficheReadIntent {
  const parsed = parseAnagraficheReadIntent(args.message);
  const typeSlug =
    parsed?.query.typeSlug ?? args.pending.data.typeSlug ?? null;
  const typeLabel =
    parsed?.query.typeLabel ?? args.pending.data.typeLabel ?? null;
  const selectedCandidate = findSelectedCandidate(
    args.message,
    args.pending.data.candidateItems ?? [],
  );
  const wantsList =
    parsed?.query.wantsList ??
    args.pending.data.wantsList ??
    parseListIntent(args.message);
  const requestedFieldsFromMessage = parseRequestedFields(
    args.message,
    typeSlug,
  );
  const requestedFields = uniqueStrings([
    ...(args.pending.data.requestedFields ?? []),
    ...requestedFieldsFromMessage,
    ...(parsed?.query.requestedFields ?? []),
  ]) as FieldKey[];
  const directQuery = parseSearchQuery({
    message: args.message,
    typeSlug,
    requestedFields,
    wantsList,
  });
  const query = selectedCandidate
    ? args.pending.data.query ?? null
    : parsed?.query.query ??
      directQuery ??
      args.pending.data.query ??
      null;

  return {
    type: "anagrafiche_read",
    query: {
      typeSlug,
      typeLabel,
      query,
      requestedFields,
      wantsList,
      selectedRecordId:
        selectedCandidate?.id ?? args.pending.data.selectedRecordId ?? null,
      selectedRecordLabel:
        selectedCandidate?.displayName ??
        args.pending.data.selectedRecordLabel ??
        null,
    },
    explanation: "Ricerca anagrafica aggiornata dal contesto pending.",
    debug: {
      matchedBy: `${parsed?.debug.matchedBy ?? "anagrafiche:pending_merge"}`,
    },
  };
}

export function mergeAnagraficheReadIntentWithFill(args: {
  intent: AnagraficheReadIntent | null;
  pending: PendingAnagraficheReadState | null;
  fill: AnagraficheReadOperationContextFillResult | null;
  message: string;
}): AnagraficheReadIntent | null {
  const baseIntent =
    args.pending && !args.intent
      ? mergePendingAnagraficheReadIntent({
          pending: args.pending,
          message: args.message,
        })
      : args.intent;

  const resolvedTypeFromFill =
    args.fill?.queryPatch.typeSlug && args.fill?.queryPatch.typeLabel
      ? {
          slug: args.fill.queryPatch.typeSlug,
          label: args.fill.queryPatch.typeLabel,
        }
      : typeof args.fill?.queryPatch.typeText === "string" &&
          args.fill.queryPatch.typeText.trim()
        ? resolveTypeFromMessage(args.fill.queryPatch.typeText.trim())
        : null;
  const requestedFieldsFromFill =
    args.fill?.queryPatch.requestedFields && resolvedTypeFromFill?.slug
      ? parseRequestedFields(
          args.fill.queryPatch.requestedFields.join(" "),
          resolvedTypeFromFill.slug,
        )
      : (args.fill?.queryPatch.requestedFields ?? []);

  if (!baseIntent && !args.pending && !args.fill) {
    return null;
  }

  const query: AnagraficheReadQuery = {
    typeSlug:
      resolvedTypeFromFill?.slug ??
      baseIntent?.query.typeSlug ??
      args.pending?.data.typeSlug ??
      null,
    typeLabel:
      resolvedTypeFromFill?.label ??
      baseIntent?.query.typeLabel ??
      args.pending?.data.typeLabel ??
      null,
    query:
      args.fill?.queryPatch.query ??
      baseIntent?.query.query ??
      args.pending?.data.query ??
      null,
    requestedFields: uniqueStrings([
      ...(args.pending?.data.requestedFields ?? []),
      ...(baseIntent?.query.requestedFields ?? []),
      ...(requestedFieldsFromFill ?? []),
    ]) as FieldKey[],
    wantsList:
      typeof args.fill?.queryPatch.wantsList === "boolean"
        ? args.fill.queryPatch.wantsList
        : baseIntent?.query.wantsList ??
          args.pending?.data.wantsList ??
          false,
    selectedRecordId: baseIntent?.query.selectedRecordId ?? args.pending?.data.selectedRecordId ?? null,
    selectedRecordLabel:
      baseIntent?.query.selectedRecordLabel ??
      args.pending?.data.selectedRecordLabel ??
      null,
  };

  return {
    type: "anagrafiche_read",
    query,
    explanation:
      baseIntent?.explanation ??
      "Intent anagrafiche ricostruito dal contesto conversazionale.",
    debug: {
      matchedBy: args.fill
        ? "anagrafiche.fill"
        : (baseIntent?.debug.matchedBy ?? "anagrafiche.pending"),
    },
  };
}

export function analyzeAnagraficheReadIntent(
  intent: AnagraficheReadIntent,
): AnagraficheReadClarification {
  const missing: string[] = [];
  if (!intent.query.typeSlug) missing.push("type");
  if (
    intent.query.typeSlug &&
    !intent.query.wantsList &&
    !intent.query.query &&
    !intent.query.selectedRecordId
  ) {
    missing.push("query");
  }

  return {
    needsClarification: missing.length > 0,
    missing,
  };
}

function formatFieldValue(value: unknown): string | null {
  if (value === null || value === undefined) return null;
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
    const objectValue = value as Record<string, unknown>;
    const addressParts = [
      formatFieldValue(objectValue.street),
      formatFieldValue(objectValue.city),
      formatFieldValue(objectValue.zip),
      formatFieldValue(objectValue.province),
      formatFieldValue(objectValue.country),
    ].filter(Boolean);
    if (addressParts.length >= 2) {
      return addressParts.join(", ");
    }
    if (objectValue.start || objectValue.end) {
      return [formatFieldValue(objectValue.start), formatFieldValue(objectValue.end)]
        .filter(Boolean)
        .join(" - ");
    }
    if (objectValue.label || objectValue.value) {
      return [formatFieldValue(objectValue.label), formatFieldValue(objectValue.value)]
        .filter(Boolean)
        .join(": ");
    }
    return JSON.stringify(objectValue);
  }
  return String(value);
}

function buildRecordSnapshot(args: {
  typeSlug: string;
  typeLabel: string;
  item: Awaited<ReturnType<typeof listAnagrafiche>>["items"][number];
  requestedFields?: FieldKey[];
}): AnagraficheRecordSnapshot {
  const typeDef = getAnagraficaDef(args.typeSlug);
  const contactFieldKeys = getContactFieldKeys(args.typeSlug);
  const fieldOrder =
    args.requestedFields && args.requestedFields.length
      ? args.requestedFields
      : (Object.keys(args.item.data ?? {}) as FieldKey[]);

  const fields = fieldOrder
    .map((fieldKey) => {
      const fieldDef = typeDef.fields[fieldKey];
      const value = formatFieldValue(args.item.data?.[fieldKey]);
      if (!fieldDef || !value) return null;
      return {
        key: fieldKey,
        label: fieldDef.label,
        value,
      };
    })
    .filter(Boolean) as AnagraficheRecordSnapshot["fields"];

  return {
    id: args.item.id,
    typeSlug: args.typeSlug,
    typeLabel: args.typeLabel,
    displayName: args.item.displayName,
    subtitle: args.item.subtitle,
    updatedAt: args.item.updatedAt,
    ownerName: args.item.ownerName ?? null,
    contactEmails: contactFieldKeys.emailFields
      .map((fieldKey) => formatFieldValue(args.item.data?.[fieldKey]))
      .filter(Boolean) as string[],
    contactPhones: contactFieldKeys.phoneFields
      .map((fieldKey) => formatFieldValue(args.item.data?.[fieldKey]))
      .filter(Boolean) as string[],
    fields,
  };
}

function buildListingPresentation(args: {
  header: string;
  lines: string[];
  footer?: string | null;
}): AnagraficheListingPresentation {
  return {
    mode: "verbatim_list",
    header: args.header,
    listBlock: args.lines.length ? args.lines.join("\n") : null,
    summaryText: args.header,
    footer: args.footer ?? null,
  };
}

export function buildAnagraficheReadQuestion(args: {
  missing: string[];
  currentQuery: AnagraficheReadQuery;
  candidateItems?: AnagraficheCandidateRecord[];
}): string {
  const missingKey = args.missing[0];
  if (missingKey === "type") {
    const labels = getAnagraficheList()
      .slice(0, 6)
      .map((typeDef) => typeDef.label)
      .join(", ");
    return `Dimmi prima su quale anagrafica devo cercare. Per esempio: ${labels}.`;
  }

  if (missingKey === "query") {
    return `Perfetto, sto guardando ${args.currentQuery.typeLabel ?? "quell'anagrafica"}. Che record vuoi cercare?`;
  }

  if (missingKey === "record" && args.candidateItems?.length) {
    const options = args.candidateItems
      .map(
        (item, index) =>
          `${index + 1}. ${item.displayName}${item.subtitle ? ` | ${item.subtitle}` : ""}`,
      )
      .join("\n");
    return `Ho trovato piu risultati, quale intendi?\n${options}`;
  }

  if (missingKey === "fields" && args.currentQuery.typeSlug) {
    const typeDef = getAnagraficaDef(args.currentQuery.typeSlug);
    const labels = Object.entries(typeDef.fields)
      .slice(0, 8)
      .map(([, fieldDef]) => fieldDef.label)
      .join(", ");
    return `Ho individuato il record. Quali campi ti interessano? Per esempio: ${labels}.`;
  }

  return "Mi aiuti a completare la ricerca con l'ultimo dettaglio che ti manca?";
}

export async function executeAnagraficheReadIntent(args: {
  auth: AuthContext;
  query: AnagraficheReadQuery;
}): Promise<AnagraficheReadExecution> {
  const typeSlug = args.query.typeSlug;
  if (!typeSlug) {
    return {
      kind: "clarification",
      phase: "collect_type",
      missing: ["type"],
      question: buildAnagraficheReadQuestion({
        missing: ["type"],
        currentQuery: args.query,
      }),
      data: {
        typeSlug: null,
        typeLabel: null,
        query: args.query.query ?? null,
        requestedFields: args.query.requestedFields ?? [],
        wantsList: args.query.wantsList ?? false,
        selectedRecordId: null,
        selectedRecordLabel: null,
        candidateItems: [],
      },
    };
  }

  const typeDef = getAnagraficaDef(typeSlug);
  const wantsList = args.query.wantsList === true;
  const requestedFields = args.query.requestedFields ?? [];
  const contactFieldKeys = getContactFieldKeys(typeSlug);
  const projectionFields = uniqueStrings([
    ...requestedFields,
    ...typeDef.preview.title,
    ...typeDef.preview.subtitle,
    ...contactFieldKeys.emailFields,
    ...contactFieldKeys.phoneFields,
  ]) as FieldKey[];

  const result = await listAnagrafiche({
    type: typeSlug,
    query: args.query.selectedRecordId ? undefined : args.query.query ?? undefined,
    ids: args.query.selectedRecordId ? [args.query.selectedRecordId] : undefined,
    limit: wantsList ? 10 : 5,
    fields: projectionFields.length ? projectionFields : undefined,
    auth: args.auth,
  });

  if (!result.items.length) {
    const header = args.query.query
      ? `Non ho trovato risultati in ${typeDef.label} per "${args.query.query}".`
      : `Non ho trovato risultati in ${typeDef.label}.`;
    return {
      kind: "result",
      result: {
        header,
        text: header,
        total: 0,
        items: [],
        presentation: {
          mode: "summarized",
          header,
          listBlock: null,
          summaryText: header,
          footer: null,
        },
      },
    };
  }

  if (!wantsList && !args.query.selectedRecordId && result.items.length > 1) {
    const candidateItems = result.items.slice(0, 5).map((item) => ({
      id: item.id,
      displayName: item.displayName,
      subtitle: item.subtitle,
    }));
    return {
      kind: "clarification",
      phase: "collect_record",
      missing: ["record"],
      question: buildAnagraficheReadQuestion({
        missing: ["record"],
        currentQuery: args.query,
        candidateItems,
      }),
      data: {
        typeSlug,
        typeLabel: typeDef.label,
        query: args.query.query ?? null,
        requestedFields,
        wantsList: false,
        selectedRecordId: null,
        selectedRecordLabel: null,
        candidateItems,
      },
      extractedThisTurn: {
        typeSlug,
        query: args.query.query ?? null,
      },
    };
  }

  const selectedItem = result.items[0];

  if (!wantsList && !requestedFields.length) {
    return {
      kind: "clarification",
      phase: "collect_fields",
      missing: ["fields"],
      question: buildAnagraficheReadQuestion({
        missing: ["fields"],
        currentQuery: {
          ...args.query,
          typeLabel: typeDef.label,
          selectedRecordId: selectedItem.id,
          selectedRecordLabel: selectedItem.displayName,
        },
      }),
      data: {
        typeSlug,
        typeLabel: typeDef.label,
        query: args.query.query ?? null,
        requestedFields: [],
        wantsList: false,
        selectedRecordId: selectedItem.id,
        selectedRecordLabel: selectedItem.displayName,
        candidateItems: [],
      },
      extractedThisTurn: {
        typeSlug,
        selectedRecordLabel: selectedItem.displayName,
      },
    };
  }

  const snapshots = wantsList
    ? result.items.map((item) =>
        buildRecordSnapshot({
          typeSlug,
          typeLabel: typeDef.label,
          item,
          requestedFields,
        }),
      )
    : [
        buildRecordSnapshot({
          typeSlug,
          typeLabel: typeDef.label,
          item: selectedItem,
          requestedFields,
        }),
      ];

  const lines = wantsList
    ? snapshots.map((item) => {
        const fieldPart =
          !requestedFields.length && item.subtitle
            ? ` | ${item.subtitle}`
            : item.fields.length
          ? ` | ${item.fields.map((field) => `${field.label}: ${field.value}`).join(" | ")}`
          : item.subtitle
            ? ` | ${item.subtitle}`
            : "";
        return `- ${item.displayName}${fieldPart}`;
      })
    : snapshots[0].fields.map(
        (field) => `- ${field.label}: ${field.value}`,
      );

  const header = wantsList
    ? `Ho trovato ${result.total} risultati in ${typeDef.label}.`
    : `${snapshots[0].displayName} in ${typeDef.label}.`;
  const footer = wantsList
    ? "Se vuoi, nel prossimo messaggio posso restringere la ricerca o mostrarti altri campi."
    : null;

  return {
    kind: "result",
    result: {
      header,
      text: [header, ...lines].join("\n"),
      total: snapshots.length,
      items: snapshots,
      presentation: buildListingPresentation({
        header,
        lines,
        footer,
      }),
    },
  };
}
