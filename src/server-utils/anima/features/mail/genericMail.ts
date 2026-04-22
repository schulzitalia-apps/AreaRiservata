import type {
  PendingGenericMailState,
  PendingMailFollowupState,
} from "@/server-utils/anima/memory/sessionState";
import type { RememberedContact } from "@/server-utils/anima/memory/contactState";
import { resolveActionFieldState } from "@/server-utils/anima/core/actionSchemas";

function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function extractEmail(value: string): string | null {
  const match = value.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  return match?.[0]?.trim().toLowerCase() ?? null;
}

export function extractEmailAddress(value: string): string | null {
  return extractEmail(value);
}

function isSelfRecipientReference(message: string): boolean {
  const normalized = normalizeText(message);
  return (
    normalized.includes("a me stesso") ||
    normalized.includes("a me stessa") ||
    normalized.includes("a me") ||
    normalized.includes("alla mia mail") ||
    normalized.includes("alla mia email") ||
    normalized.includes("alla mia posta") ||
    normalized.includes("al mio indirizzo") ||
    normalized.includes("al mio indirizzo email") ||
    normalized.includes("al mio indirizzo mail") ||
    normalized.includes("al mio account") ||
    normalized.includes("alla mia casella")
  );
}

function extractSubject(message: string): string | undefined {
  const quoted =
    message.match(/oggetto\s*[:=]\s*"([^"]+)"/i) ||
    message.match(/oggetto\s*[:=]\s*'([^']+)'/i);
  if (quoted?.[1]?.trim()) return quoted[1].trim();

  const loose = message.match(/oggetto\s*[:=]\s*([^.!\n]+)/i);
  if (loose?.[1]?.trim()) return loose[1].trim();

  return undefined;
}

function stripMailScaffolding(message: string): string {
  return message
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, " ")
    .replace(/\b(vorrei|devo|potresti|puoi|mi\s+puoi|mi\s+serve)\b/gi, " ")
    .replace(/\b(manda|mandami|mandare|invia|inviami|inviare|scrivi|spedire)\b/gi, " ")
    .replace(/\b(una|un)\b/gi, " ")
    .replace(/\b(mail|email)\b/gi, " ")
    .replace(/\b(a|ad)\b/gi, " ")
    .replace(/\boggetto\s*[:=].*/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractMessage(message: string): string | undefined {
  const quoted =
    message.match(/(?:dicendo|testo|contenuto)\s*[:=]\s*"([^"]+)"/i) ||
    message.match(/(?:dicendo|testo|contenuto)\s*[:=]\s*'([^']+)'/i);
  if (quoted?.[1]?.trim()) return quoted[1].trim();

  const explicit =
    message.match(/\b(?:dicendo|scrivendo|testo|contenuto)\s+([^.!\n]+)/i) ||
    message.match(/\bche\s+dice\s+([^.!\n]+)/i);
  if (explicit?.[1]?.trim()) return explicit[1].trim();

  const stripped = stripMailScaffolding(message);
  const normalized = normalizeText(stripped);
  const emptyLike = [
    "",
    "mail",
    "email",
    "manda",
    "mandami",
    "invia",
    "inviami",
    "scrivi",
    "vorrei",
    "vorrei una",
    "vorrei un",
  ];
  if (emptyLike.includes(normalized)) return undefined;
  return stripped.length >= 8 ? stripped : undefined;
}

export function detectMailDecline(message: string): boolean {
  const normalized = normalizeText(message);
  return (
    normalized === "no" ||
    normalized === "no grazie" ||
    normalized.includes("senza mail") ||
    normalized.includes("non serve") ||
    normalized.includes("non mandarla")
  );
}

export function detectMailAccept(message: string): boolean {
  const normalized = normalizeText(message);
  return (
    normalized === "si" ||
    normalized === "si grazie" ||
    normalized === "ok" ||
    normalized === "ok manda" ||
    normalized === "manda" ||
    normalized === "invia" ||
    normalized === "vai"
  );
}

export function resolveMailFollowupRecipient(args: {
  message: string;
  pending: PendingMailFollowupState;
}): string | null | undefined {
  const explicitEmail = extractEmail(args.message);
  if (explicitEmail) return explicitEmail;
  if (isSelfRecipientReference(args.message)) {
    return args.pending.data.selectedTo ?? args.pending.data.defaultTo ?? null;
  }
  if (detectMailAccept(args.message)) {
    return args.pending.data.selectedTo ?? args.pending.data.defaultTo ?? null;
  }
  if (detectMailDecline(args.message)) {
    return null;
  }
  return undefined;
}

export function resolveSelfRecipientEmail(args: {
  message: string;
  defaultEmail?: string | null;
}): string | null {
  if (!args.defaultEmail) return null;
  return isSelfRecipientReference(args.message) ? args.defaultEmail : null;
}

export function parseGenericMailIntent(message: string): {
  to?: string | null;
  subject?: string;
  message?: string;
  missing: string[];
} | null {
  const normalized = normalizeText(message);
  if (!normalized) return null;

  const wantsMail =
    normalized.includes("mail") || normalized.includes("email");
  const wantsSend =
    normalized.includes("manda") ||
    normalized.includes("mandami") ||
    normalized.includes("mandare") ||
    normalized.includes("invia") ||
    normalized.includes("inviami") ||
    normalized.includes("inviare") ||
    normalized.includes("spedire") ||
    normalized.includes("scrivi");

  if (!wantsMail || !wantsSend) return null;

  const to = extractEmail(message);
  const subject = extractSubject(message);
  const body = extractMessage(message);
  const fieldState = resolveActionFieldState({
    actionKey: "generic_mail",
    data: {
      to,
      message: body,
      subject,
    },
  });

  return {
    to,
    subject,
    message: body,
    missing: fieldState.missing,
  };
}

export function resolveRecipientFromRememberedContacts(args: {
  message: string;
  contacts: RememberedContact[];
}): {
  email: string | null;
  matchedBy: string | null;
  contact: RememberedContact | null;
} {
  const contactsWithEmail = args.contacts.filter((contact) => contact.emails.length > 0);
  if (!contactsWithEmail.length) {
    return { email: null, matchedBy: null, contact: null };
  }

  const normalized = normalizeText(args.message);
  const genericReference =
    normalized.includes("quel cliente") ||
    normalized.includes("quel contatto") ||
    normalized.includes("quella anagrafica") ||
    normalized.includes("quel fornitore") ||
    normalized.includes("la mail di") ||
    normalized.includes("l email di") ||
    normalized.includes("all indirizzo di") ||
    normalized.includes("a dentifrici") ||
    normalized.includes("a lui") ||
    normalized.includes("a lei") ||
    normalized.includes("a quel") ||
    normalized.includes("a questa") ||
    normalized.includes("a questo");

  let bestMatch: { contact: RememberedContact; score: number; matchedBy: string } | null = null;

  for (const contact of contactsWithEmail) {
    const displayName = normalizeText(contact.displayName);
    const typeLabel = normalizeText(contact.typeLabel);
    let score = 0;
    let matchedBy = "";

    if (displayName && normalized.includes(displayName)) {
      score = Math.max(score, displayName.length + 10);
      matchedBy = "display_name";
    }

    if (typeLabel && normalized.includes(typeLabel)) {
      score = Math.max(score, typeLabel.length + 3);
      matchedBy = matchedBy || "type_label";
    }

    if (!bestMatch || score > bestMatch.score) {
      bestMatch =
        score > 0
          ? {
              contact,
              score,
              matchedBy,
            }
          : bestMatch;
    }
  }

  if (bestMatch?.contact?.emails[0]) {
    return {
      email: bestMatch.contact.emails[0],
      matchedBy: bestMatch.matchedBy,
      contact: bestMatch.contact,
    };
  }

  if (genericReference) {
    const contact = contactsWithEmail[0];
    return {
      email: contact.emails[0] ?? null,
      matchedBy: "recent_contact_reference",
      contact,
    };
  }

  return { email: null, matchedBy: null, contact: null };
}

export function mergePendingGenericMailState(args: {
  pending: PendingGenericMailState | null;
  message: string;
}): PendingGenericMailState | null {
  const parsed = parseGenericMailIntent(args.message);
  const directEmail = extractEmail(args.message);
  const fallbackMessage =
    !parsed?.message && !directEmail ? extractMessage(args.message) : parsed?.message;

  const to = parsed?.to ?? directEmail ?? args.pending?.data.to ?? null;
  const subject = parsed?.subject ?? args.pending?.data.subject ?? null;
  const message = fallbackMessage ?? args.pending?.data.message ?? null;

  if (!to && !message && !subject) {
    return args.pending;
  }

  const fieldState = resolveActionFieldState({
    actionKey: "generic_mail",
    data: {
      to,
      message,
      subject,
    },
  });

  return {
    operation: "generic_mail",
    phase: fieldState.missing.includes("destinatario")
      ? "collect_recipient"
      : fieldState.missing.includes("contenuto")
        ? "collect_message"
        : "ready",
    readiness: fieldState.readiness,
    data: {
      to,
      subject,
      message,
    },
    missing: fieldState.missing,
    updatedAt: new Date().toISOString(),
  };
}

export function mergePendingGenericMailStateWithPatch(args: {
  pending: PendingGenericMailState | null;
  state: PendingGenericMailState | null;
  patch?: {
    to?: string | null;
    subject?: string;
    message?: string;
  } | null;
}): PendingGenericMailState | null {
  const base = args.state ?? args.pending;
  if (!base && !args.patch) {
    return null;
  }

  const to =
    typeof args.patch?.to !== "undefined"
      ? args.patch.to
      : base?.data.to ?? null;
  const subject =
    typeof args.patch?.subject !== "undefined"
      ? args.patch.subject
      : base?.data.subject ?? null;
  const message =
    typeof args.patch?.message !== "undefined"
      ? args.patch.message
      : base?.data.message ?? null;

  if (!to && !subject && !message) {
    return base;
  }

  const fieldState = resolveActionFieldState({
    actionKey: "generic_mail",
    data: {
      to,
      subject,
      message,
    },
  });

  return {
    operation: "generic_mail",
    phase: fieldState.missing.includes("destinatario")
      ? "collect_recipient"
      : fieldState.missing.includes("contenuto")
        ? "collect_message"
        : "ready",
    readiness: fieldState.readiness,
    data: {
      to,
      subject: subject ?? null,
      message: message ?? null,
    },
    missing: fieldState.missing,
    updatedAt: new Date().toISOString(),
  };
}
