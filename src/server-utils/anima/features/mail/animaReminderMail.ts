import { connectToDatabase } from "@/server-utils/lib/mongoose-connection";
import { sendEmail } from "@/server-utils/lib/sendEmail";
import { resolveSystemSender } from "@/server-utils/service/mail/senderResolver";
import { composeMailWithLlm } from "@/server-utils/anima/mailComposer";
import { ANIMA_RUNTIME_CONFIG } from "@/server-utils/anima/config/anima.runtime.config";
import type { AnimaLlmTraceStep } from "@/server-utils/anima/core/types";

type EventDigestItem = {
  label: string;
  displayName: string;
  startAt?: string | null;
};

function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function detectReminderMailIntent(message: string): {
  wantsMail: boolean;
  wantsCreateAndMail: boolean;
  wantsDigestMail: boolean;
} {
  const normalized = normalizeText(message);
  if (!normalized) {
    return { wantsMail: false, wantsCreateAndMail: false, wantsDigestMail: false };
  }

  const mentionsMail =
    normalized.includes("mail") ||
    normalized.includes("email") ||
    normalized.includes("posta");

  const mentionsReminder =
    normalized.includes("promemoria") ||
    normalized.includes("ricord");

  const mentionsSend =
    normalized.includes("manda") ||
    normalized.includes("mandami") ||
    normalized.includes("invia") ||
    normalized.includes("inviami");

  const mentionsCreate =
    normalized.includes("crea") ||
    normalized.includes("aggiungi") ||
    normalized.includes("fissa") ||
    normalized.includes("programma");

  const mentionsDigestCue =
    normalized.includes("riepilogo") ||
    normalized.includes("riassunto") ||
    normalized.includes("breakdown") ||
    normalized.includes("elenco") ||
    normalized.includes("degli eventi") ||
    normalized.includes("dei prossimi") ||
    normalized.includes("degli ultimi") ||
    normalized.includes("eventi dei") ||
    normalized.includes("eventi degli");

  const mentionsSpecificSingleItem =
    normalized.includes("memo di ") ||
    normalized.includes("memo per ") ||
    normalized.includes("appuntamento di ") ||
    normalized.includes("appuntamento per ") ||
    normalized.includes("evento di ") ||
    normalized.includes("evento per ");

  const wantsMail = mentionsMail || (mentionsReminder && mentionsSend);
  const wantsDigestMail =
    wantsMail && mentionsDigestCue && !mentionsSpecificSingleItem;

  return {
    wantsMail,
    wantsCreateAndMail: wantsMail && mentionsCreate,
    wantsDigestMail,
  };
}

function buildFallbackMail(args: {
  displayName?: string | null;
  subjectHint: string;
  intro: string;
  items: string[];
  signatureName?: string | null;
}) {
  const greeting = args.displayName ? `Ciao ${args.displayName},` : "Ciao,";
  const html = [
    `<p>${greeting}</p>`,
    `<p>${args.intro}</p>`,
    "<ul>",
    ...args.items.map((item) => `<li>${item}</li>`),
    "</ul>",
    `<p>A presto,<br/>${args.signatureName || ANIMA_RUNTIME_CONFIG.mail.signatureName}</p>`,
  ].join("");

  return {
    subject: args.subjectHint,
    html,
  };
}

async function composeReminderMail(args: {
  templateKey: string;
  vars: Record<string, any>;
  userGoal: string;
  displayName?: string | null;
  fallbackSubject: string;
  fallbackIntro: string;
  fallbackItems: string[];
  signatureName?: string | null;
  traceCollector?: (step: AnimaLlmTraceStep) => void;
}) {
  try {
    const composed = await composeMailWithLlm({
      templateKey: args.templateKey,
      currentVars: args.vars,
      userGoal: args.userGoal,
      language: "it",
      traceCollector: args.traceCollector,
    });

    return {
      subject: composed.rendered.subject,
      html: composed.rendered.html,
      composedWith: `${composed.provider}_template`,
    } as const;
  } catch {
    const fallback = buildFallbackMail({
      displayName: args.displayName,
      subjectHint: args.fallbackSubject,
      intro: args.fallbackIntro,
      items: args.fallbackItems,
      signatureName: args.signatureName,
    });

    return {
      subject: fallback.subject,
      html: fallback.html,
      composedWith: "fallback_html",
    } as const;
  }
}

async function resolveAnimaMailSender() {
  const sender = await resolveSystemSender();
  if (!sender.allowed || !sender.fromEmail) {
    return sender;
  }

  return {
    ...sender,
    fromName:
      ANIMA_RUNTIME_CONFIG.mail.senderDisplayName || sender.fromName || "Anima",
  };
}

export async function sendEventsDigestMail(args: {
  to: string;
  displayName?: string | null;
  templateKey: string;
  subjectHint: string;
  intro: string;
  userGoal: string;
  items: EventDigestItem[];
  traceCollector?: (step: AnimaLlmTraceStep) => void;
}) {
  await connectToDatabase();
  const sender = await resolveAnimaMailSender();
  if (!sender.allowed || !sender.fromEmail || !sender.fromName) {
    throw new Error(sender.reason || "MAIL_SENDER_NOT_AVAILABLE");
  }

  const fallbackItems = args.items.map((item) => {
    const when = item.startAt
      ? new Date(item.startAt).toLocaleString("it-IT", {
          dateStyle: "short",
          timeStyle: "short",
        })
      : "senza data";
    return `[${item.label}] ${item.displayName} (${when})`;
  });

  const composed = await composeReminderMail({
    templateKey: args.templateKey,
    vars: {
      userName: args.displayName ?? "Utente",
      events: fallbackItems,
      signatureName: ANIMA_RUNTIME_CONFIG.mail.signatureName,
    },
    userGoal: args.userGoal,
    displayName: args.displayName,
    fallbackSubject: args.subjectHint,
    fallbackIntro: args.intro,
    fallbackItems,
    signatureName: ANIMA_RUNTIME_CONFIG.mail.signatureName,
    traceCollector: args.traceCollector,
  });

  const from = `${sender.fromName} <${sender.fromEmail}>`;
  const out = await sendEmail({
    to: [args.to],
    subject: composed.subject,
    html: composed.html,
    replyTo: sender.replyToEmail || null,
    from,
  });

  return {
    messageId: out.messageId,
    composedWith: composed.composedWith,
  };
}

export async function sendCreatedEventReminderMail(args: {
  to: string;
  displayName?: string | null;
  templateKey: string;
  eventTypeLabel: string;
  title: string;
  startAt?: string | null;
  endAt?: string | null;
  notes?: string | null;
  traceCollector?: (step: AnimaLlmTraceStep) => void;
}) {
  await connectToDatabase();
  const sender = await resolveAnimaMailSender();
  if (!sender.allowed || !sender.fromEmail || !sender.fromName) {
    throw new Error(sender.reason || "MAIL_SENDER_NOT_AVAILABLE");
  }

  const when = args.startAt
    ? new Date(args.startAt).toLocaleString("it-IT", {
        dateStyle: "short",
        timeStyle: "short",
      })
    : "senza data";

  const interval = args.endAt
    ? ` fino alle ${new Date(args.endAt).toLocaleTimeString("it-IT", {
        hour: "2-digit",
        minute: "2-digit",
      })}`
    : "";

  const fallbackItems = [
    `Tipo evento: ${args.eventTypeLabel}`,
    `Titolo: ${args.title}`,
    `Quando: ${when}${interval}`,
    ...(args.notes ? [`Note: ${args.notes}`] : []),
  ];

  const composed = await composeReminderMail({
    templateKey: args.templateKey,
    vars: {
      userName: args.displayName ?? "Utente",
      eventTypeLabel: args.eventTypeLabel,
      title: args.title,
      when: `${when}${interval}`,
      notes: args.notes ?? "",
      signatureName: ANIMA_RUNTIME_CONFIG.mail.signatureName,
    },
    userGoal:
      "Scrivi una mail breve e gentile che confermi all'utente il promemoria del nuovo evento appena creato.",
    displayName: args.displayName,
    fallbackSubject: `Promemoria: ${args.title}`,
    fallbackIntro: "Ti confermo il promemoria via email per l'evento appena creato.",
    fallbackItems,
    signatureName: ANIMA_RUNTIME_CONFIG.mail.signatureName,
    traceCollector: args.traceCollector,
  });

  const from = `${sender.fromName} <${sender.fromEmail}>`;
  const out = await sendEmail({
    to: [args.to],
    subject: composed.subject,
    html: composed.html,
    replyTo: sender.replyToEmail || null,
    from,
  });

  return {
    messageId: out.messageId,
    composedWith: composed.composedWith,
  };
}

export async function sendGenericMail(args: {
  to: string;
  displayName?: string | null;
  templateKey: string;
  subject?: string | null;
  message: string;
  traceCollector?: (step: AnimaLlmTraceStep) => void;
}) {
  await connectToDatabase();
  const sender = await resolveAnimaMailSender();
  if (!sender.allowed || !sender.fromEmail || !sender.fromName) {
    throw new Error(sender.reason || "MAIL_SENDER_NOT_AVAILABLE");
  }

  const fallbackSubject =
    args.subject?.trim() || ANIMA_RUNTIME_CONFIG.mail.genericSubjectDefault;
  const fallbackItems = [args.message.trim()];

  const composed = await composeReminderMail({
    templateKey: args.templateKey,
    vars: {
      userName: args.displayName ?? "Utente",
      message: args.message,
      signatureName: ANIMA_RUNTIME_CONFIG.mail.signatureName,
    },
    userGoal:
      "Scrivi una mail chiara, professionale e naturale che rispetti esattamente il messaggio fornito dall'utente.",
    displayName: args.displayName,
    fallbackSubject,
    fallbackIntro: "Ti inoltro questo messaggio preparato tramite Anima.",
    fallbackItems,
    signatureName: ANIMA_RUNTIME_CONFIG.mail.signatureName,
    traceCollector: args.traceCollector,
  });

  const from = `${sender.fromName} <${sender.fromEmail}>`;
  const out = await sendEmail({
    to: [args.to],
    subject: composed.subject,
    html: composed.html,
    replyTo: sender.replyToEmail || null,
    from,
  });

  return {
    messageId: out.messageId,
    composedWith: composed.composedWith,
  };
}
