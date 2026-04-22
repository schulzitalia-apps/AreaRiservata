import { ANIMA_RUNTIME_CONFIG } from "@/server-utils/anima/config/anima.runtime.config";

export function buildCapabilitiesReply(): string {
  const capabilities = ANIMA_RUNTIME_CONFIG.texts.fallbackCapabilities.map(
    (item) => `- ${item}`,
  );
  const examples = ANIMA_RUNTIME_CONFIG.texts.helpExamples
    .slice(0, 2)
    .map((item) => `\`${item.prompt}\``);

  return [
    "Non sono sicura di aver capito bene cosa vuoi fare.",
    "Per ora posso aiutarti soprattutto a:",
    ...capabilities,
    "",
    `Se vuoi, puoi scrivermi cose come ${examples.join(" oppure ")}.`,
  ].join("\n");
}

export function buildWelcomeReply(displayName?: string | null): string {
  const greetingName = displayName ? ` ${displayName}` : "";
  const capabilities = ANIMA_RUNTIME_CONFIG.texts.welcomeCapabilities.map(
    (item) => `- ${item}`,
  );

  return [
    `Buongiorno${greetingName}.`,
    "Posso aiutarti soprattutto a:",
    ...capabilities,
    "",
    "Cosa posso fare oggi per te?",
  ].join("\n");
}

export function buildNeedEventTypeReply(eventTypeLabels: string[]): string {
  return [
    "Ho capito che vuoi inserire un evento, ma non mi e ancora chiaro di che tipo.",
    `I tipi che posso usare adesso sono: ${eventTypeLabels.join(", ")}.`,
    "Se vuoi, scrivimi direttamente qualcosa come: `crea memo domani alle 10` oppure `crea appuntamento giovedi dalle 10 alle 11`.",
  ].join("\n\n");
}

export function buildCreateQuestion(args: {
  missingField: string;
  eventTypeLabel?: string | null;
}): string {
  const subject = args.eventTypeLabel
    ? `per ${args.eventTypeLabel}`
    : "per l'evento";

  if (args.missingField === "title") {
    return `Perfetto, ci siamo quasi: che titolo vuoi mettere ${subject}?`;
  }

  if (args.missingField === "time") {
    return `Va bene. Quando lo vuoi mettere ${subject}? Puoi scrivermi cose come \`domani alle 15\`, \`martedi dalle 10 alle 11\` o \`giovedi\`.`;
  }

  if (args.missingField === "date") {
    return `Perfetto, l'orario l'ho gia preso ${subject}. Mi manca solo il giorno o la data. Puoi scrivermi cose come \`domani\`, \`giovedi\` o \`15/04\`.`;
  }

  if (args.missingField === "notes") {
    return `Se vuoi, possiamo aggiungere anche una nota ${subject}. Se non ti serve, dimmi pure \`senza note\`.`;
  }

  return `Mi manca ancora un dettaglio ${subject}.`;
}

export function buildInvalidIntervalReply(args: {
  eventTypeLabel?: string | null;
}): string {
  const subject = args.eventTypeLabel
    ? `per ${args.eventTypeLabel}`
    : "per l'evento";
  return `C'e solo un punto da sistemare ${subject}: l'orario finale deve venire dopo quello iniziale. Se vuoi, riscrivimelo in una forma come \`domani dalle 10 alle 11\` oppure \`martedi alle 15\`.`;
}

export function buildPendingTaskReminder(args: {
  phase?: string;
  eventTypeLabel?: string | null;
}): string {
  const subject = args.eventTypeLabel
    ? `per ${args.eventTypeLabel}`
    : "per l'evento";

  if (args.phase === "collect_title") {
    return `Stiamo completando la creazione ${subject}: mi manca ancora il titolo.`;
  }

  if (args.phase === "collect_time") {
    return `Stiamo completando la creazione ${subject}: mi manca ancora quando metterlo.`;
  }

  if (args.phase === "collect_type") {
    return "Stiamo completando la creazione, ma mi manca ancora il tipo evento.";
  }

  if (args.phase === "collect_notes") {
    return `Stiamo completando la creazione ${subject}: se vuoi puoi aggiungere una nota, altrimenti scrivimi \`senza note\`.`;
  }

  return "Stiamo ancora completando l'ultimo evento che stavamo costruendo insieme.";
}

export function buildEventListQuestion(args: {
  availableTypes: string[];
  missing: string[];
  eventTypeLabel?: string | null;
  periodHint?: string | null;
  ambiguousOptions?: string[] | null;
}): string {
  const parts: string[] = [];
  const periodHint = args.periodHint?.trim()
    ? ` ${args.periodHint.trim()}`
    : "";

  if (args.missing.includes("tipo eventi")) {
    if (args.ambiguousOptions?.length) {
      parts.push(
        `Per il periodo${periodHint} qui ho un dubbio sul tipo evento: intendi ${args.ambiguousOptions.join(" oppure ")}?`,
      );
    } else {
      parts.push(
        args.eventTypeLabel
          ? `Per il periodo${periodHint} sto gia tenendo il filtro su ${args.eventTypeLabel}.`
          : `Per il periodo${periodHint} mi aiuta sapere che tipo di eventi vuoi vedere.`,
      );
      parts.push(
        `Le tipologie che posso cercare ora sono: ${args.availableTypes.join(", ")}.`,
      );
    }
  }

  if (args.missing.includes("quantita risultati")) {
    parts.push(
      "Se vuoi, dimmi anche quanti risultati ti servono: ad esempio 3, 10 oppure tutti.",
    );
  }

  if (!parts.length) {
    parts.push("Dimmi solo come vuoi restringere la ricerca e vado subito.");
  }

  return parts.join("\n\n");
}

export function buildOperationCancelledReply(): string {
  return "Va bene, annullo l'operazione in corso e ripartiamo puliti.";
}

export function buildCreateSuccessReply(args: {
  eventTypeLabel?: string | null;
  title?: string | null;
  startAt?: string | null;
  endAt?: string | null;
  emailHint?: string | null;
}): string {
  const typeLabel = args.eventTypeLabel ?? "evento";
  const title = args.title?.trim() ? `"${args.title.trim()}"` : "senza titolo";

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

  const mailHint = args.emailHint
    ? `\n\nSe vuoi, posso anche mandarti un promemoria via email a ${args.emailHint}.`
    : "";

  return `Perfetto, ho preparato ${typeLabel} ${title} per ${when}${interval}.${mailHint}`;
}

export function buildMailSentReply(args: {
  displayName?: string | null;
  email: string;
  subjectHint: string;
}): string {
  const who = args.displayName ? ` ${args.displayName}` : "";
  return `Perfetto${who}, ho inviato una mail a ${args.email} con oggetto "${args.subjectHint}".`;
}

export function buildMissingEmailReply(): string {
  return "Posso mandarti il promemoria via email, ma nel tuo profilo non vedo ancora un indirizzo email configurato.";
}

export function buildMailUnavailableReply(args?: {
  reason?: string | null;
}): string {
  const suffix = args?.reason ? ` (${args.reason})` : "";
  return `Ho tenuto il flusso pronto, ma in questo momento il sistema mail non riesce a inviare${suffix}.`;
}

export function buildMailSkippedReply(): string {
  return "Va bene, non mando nessuna mail e lasciamo l'evento cosi.";
}

export function buildMailFollowupQuestion(args: {
  email?: string | null;
  title?: string | null;
}): string {
  const target = args.email ? ` a ${args.email}` : "";
  const title = args.title?.trim() ? ` per "${args.title.trim()}"` : "";

  return `Se vuoi, ti mando anche un promemoria via email${target}${title}. Puoi rispondermi \`si manda\`, \`no\` oppure indicarmi un altro indirizzo email.`;
}

export function buildGenericMailQuestion(
  missingField: "recipient" | "content",
): string {
  if (missingField === "recipient") {
    return "Va bene: a quale indirizzo email la devo mandare?";
  }

  return "Perfetto. Che messaggio vuoi che invii nella mail? Se vuoi, puoi aggiungere anche un oggetto, ma non e obbligatorio.";
}
