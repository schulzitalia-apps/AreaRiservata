type Primitive = string | number | boolean | null | undefined;

type RelatedNode = {
  typeSlug: string;
  id: string;
  data?: Record<string, any>;
};

type PickedRecipientInput = {
  scope: "ANAGRAFICA";
  typeSlug: string;
  id: string;
  label: string;
  emails: string[];
  allEmails?: string[];
  data?: Record<string, any>;
  related?: RelatedNode[];
};

const PRIORITY_KEYS = [
  "ragioneSociale",
  "nome",
  "cognome",
  "denominazione",
  "email",
  "telefono",
  "cellulare",
  "localita",
  "citta",
  "provincia",
  "indirizzo",
  "cap",
  "riferimento",
  "numeroOrdine",
  "inizioConsegna",
  "fineConsegna",
  "note",
];

const TECHNICAL_KEYS = new Set([
  "__meta",
  "_id",
  "__v",
  "createdAt",
  "updatedAt",
  "owner",
  "visibility",
  "visibleTo",
]);

function isPlainObject(value: unknown): value is Record<string, any> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function isPrimitive(value: unknown): value is Primitive {
  return value == null || ["string", "number", "boolean"].includes(typeof value);
}

function isNonEmptyPrimitive(
  value: Primitive,
): value is Exclude<Primitive, null | undefined> {
  if (value == null) return false;
  if (typeof value === "string") return value.trim().length > 0;
  return true;
}

function normalizeDisplayValue(
  value: unknown,
): string | number | boolean | string[] | null {
  if (isPrimitive(value)) {
    return isNonEmptyPrimitive(value)
      ? typeof value === "string"
        ? value.trim()
        : value
      : null;
  }

  if (Array.isArray(value)) {
    const flat = value
      .filter(isPrimitive)
      .filter(isNonEmptyPrimitive)
      .map((item) => (typeof item === "string" ? item.trim() : String(item)));

    return flat.length ? flat.slice(0, 4) : null;
  }

  return null;
}

function orderKeys(keys: string[]) {
  return [...keys].sort((a, b) => {
    const ai = PRIORITY_KEYS.indexOf(a);
    const bi = PRIORITY_KEYS.indexOf(b);

    if (ai >= 0 && bi >= 0) return ai - bi;
    if (ai >= 0) return -1;
    if (bi >= 0) return 1;
    return a.localeCompare(b);
  });
}

export function sanitizeMailData(
  data: Record<string, any> | undefined,
  maxFields = 10,
) {
  if (!isPlainObject(data)) return {};

  const out: Record<string, any> = {};
  const keys = orderKeys(
    Object.keys(data).filter((key) => !TECHNICAL_KEYS.has(key)),
  );

  for (const key of keys) {
    const normalized = normalizeDisplayValue(data[key]);
    if (normalized == null) continue;
    out[key] = normalized;
    if (Object.keys(out).length >= maxFields) break;
  }

  return out;
}

export function buildRecipientVars(recipient: PickedRecipientInput | null) {
  if (!recipient) return {};

  const chosenEmail = String(recipient.emails?.[0] || "").trim();

  const allEmails = (
    recipient.allEmails?.length ? recipient.allEmails : recipient.emails || []
  )
    .map((email) => String(email || "").trim())
    .filter(Boolean);

  return {
    recipient: {
      scope: recipient.scope,
      email: chosenEmail || null,
      emailsAll: allEmails,
    },
    anagrafica: {
      type: recipient.typeSlug,
      id: recipient.id,
      label: recipient.label,
      data: sanitizeMailData(recipient.data, 10),
      related: (recipient.related || [])
        .map((node) => ({
          typeSlug: node.typeSlug,
          id: node.id,
          data: sanitizeMailData(node.data, 6),
        }))
        .filter((node) => Object.keys(node.data || {}).length > 0)
        .slice(0, 4),
    },
  };
}

function sanitizeComposeValue(value: any, depth: number): any {
  if (depth < 0) return undefined;

  if (isPrimitive(value)) {
    return isNonEmptyPrimitive(value) ? value : undefined;
  }

  if (Array.isArray(value)) {
    const cleaned = value
      .map((item) => sanitizeComposeValue(item, depth - 1))
      .filter((item) => item !== undefined);

    return cleaned.length ? cleaned.slice(0, 6) : undefined;
  }

  if (!isPlainObject(value)) return undefined;

  const out: Record<string, any> = {};

  for (const key of Object.keys(value)) {
    if (TECHNICAL_KEYS.has(key)) continue;

    const cleaned = sanitizeComposeValue(value[key], depth - 1);
    if (cleaned !== undefined) out[key] = cleaned;
  }

  return Object.keys(out).length ? out : undefined;
}

export function sanitizeVarsForCompose(vars: Record<string, any>) {
  return (sanitizeComposeValue(vars, 4) ?? {}) as Record<string, any>;
}

export function buildMailContextPreview(vars: Record<string, any>) {
  const anagrafica = isPlainObject(vars.anagrafica) ? vars.anagrafica : {};
  const recipient = isPlainObject(vars.recipient) ? vars.recipient : {};
  const data = isPlainObject(anagrafica.data) ? anagrafica.data : {};
  const related = Array.isArray(anagrafica.related) ? anagrafica.related : [];

  const fields = Object.entries(data).map(([key, value]) => ({
    key,
    value: Array.isArray(value) ? value.join(", ") : String(value),
  }));

  const relatedSummary = related
    .map((node: any) => {
      const nodeData = isPlainObject(node?.data) ? node.data : {};
      const firstField = Object.entries(nodeData)[0];

      if (!firstField) return null;

      return {
        label: String(node?.typeSlug || "reference"),
        value: `${firstField[0]}: ${
          Array.isArray(firstField[1])
            ? firstField[1].join(", ")
            : String(firstField[1])
        }`,
      };
    })
    .filter(Boolean) as Array<{ label: string; value: string }>;

  return {
    recipientLabel: typeof anagrafica.label === "string" ? anagrafica.label : "",
    recipientType: typeof anagrafica.type === "string" ? anagrafica.type : "",
    recipientEmail: typeof recipient.email === "string" ? recipient.email : "",
    fields,
    relatedSummary,
  };
}

export function detectDraftWarnings(draft: {
  subject?: string;
  bodyText?: string;
  html?: string;
}) {
  const haystack = `${draft.subject || ""}\n${draft.bodyText || ""}\n${
    draft.html || ""
  }`.toLowerCase();

  const warnings: string[] = [];

  if (haystack.includes("{{") || haystack.includes("}}")) {
    warnings.push("La bozza contiene ancora placeholder template non risolti.");
  }

  if (haystack.includes("mario") && haystack.includes("ciao")) {
    warnings.push("La bozza contiene testo placeholder che va rivisto.");
  }

  return warnings;
}