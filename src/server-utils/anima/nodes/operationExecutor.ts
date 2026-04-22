import type { AuthContext } from "@/server-utils/lib/auth-context";
import { ANIMA_RUNTIME_CONFIG } from "@/server-utils/anima/config/anima.runtime.config";
import type { AnimaLlmTraceStep } from "@/server-utils/anima/core/types";
import {
  executeEventCreateIntent,
  type EventCreateIntent,
} from "@/server-utils/anima/features/eventi/eventi.create";
import {
  sendCreatedEventReminderMail,
  sendEventsDigestMail,
  sendGenericMail,
} from "@/server-utils/anima/features/mail/animaReminderMail";

export type EventCreateExecutionResult = {
  kind: "event_create";
  createdId: string;
  payload: EventCreateIntent["payload"];
};

export type CreatedEventReminderMailExecutionResult = {
  kind: "created_event_reminder_mail";
  to: string;
  subjectHint: string;
  mail: {
    messageId: string;
    composedWith: string;
  };
};

export type GenericMailExecutionResult = {
  kind: "generic_mail";
  to: string;
  subjectHint: string;
  mail: {
    messageId: string;
    composedWith: string;
  };
};

export type EventsDigestMailExecutionResult = {
  kind: "events_digest_mail";
  to: string;
  subjectHint: string;
  returned: number;
  mail: {
    messageId: string;
    composedWith: string;
  };
};

export async function executeEventCreateOperation(args: {
  auth: AuthContext;
  userId: string;
  intent: EventCreateIntent;
}): Promise<EventCreateExecutionResult> {
  const created = await executeEventCreateIntent({
    auth: args.auth,
    userId: args.userId,
    intent: args.intent,
  });

  return {
    kind: "event_create",
    createdId: created.id,
    payload: args.intent.payload,
  };
}

export async function executeCreatedEventReminderMailOperation(args: {
  to: string;
  displayName?: string | null;
  templateKey: string;
  eventTypeLabel: string;
  title: string;
  startAt?: string | null;
  endAt?: string | null;
  notes?: string | null;
  traceCollector?: (step: AnimaLlmTraceStep) => void;
}): Promise<CreatedEventReminderMailExecutionResult> {
  const mail = await sendCreatedEventReminderMail(args);

  return {
    kind: "created_event_reminder_mail",
    to: args.to,
    subjectHint: `Promemoria: ${args.title}`,
    mail,
  };
}

export async function executeGenericMailOperation(args: {
  to: string;
  displayName?: string | null;
  templateKey: string;
  subject?: string | null;
  message: string;
  traceCollector?: (step: AnimaLlmTraceStep) => void;
}): Promise<GenericMailExecutionResult> {
  const mail = await sendGenericMail(args);

  return {
    kind: "generic_mail",
    to: args.to,
    subjectHint:
      args.subject?.trim() || ANIMA_RUNTIME_CONFIG.mail.genericSubjectDefault,
    mail,
  };
}

export async function executeEventsDigestMailOperation(args: {
  to: string;
  displayName?: string | null;
  templateKey: string;
  subjectHint: string;
  intro: string;
  userGoal: string;
  items: Array<{
    label: string;
    displayName: string;
    startAt?: string | null;
  }>;
  traceCollector?: (step: AnimaLlmTraceStep) => void;
}): Promise<EventsDigestMailExecutionResult> {
  const mail = await sendEventsDigestMail(args);

  return {
    kind: "events_digest_mail",
    to: args.to,
    subjectHint: args.subjectHint,
    returned: args.items.length,
    mail,
  };
}
