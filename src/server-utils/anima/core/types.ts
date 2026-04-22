export type AnimaChannel =
  | "internal"
  | "twilio_whatsapp"
  | "meta_whatsapp"
  | "twilio_voice"
  | "telegram";

export type AnimaCapability =
  | "conversation.reply"
  | "conversation.help.events"
  | "anagrafiche.read"
  | "anagrafiche.create"
  | "eventi.types.list"
  | "eventi.recent.summary"
  | "eventi.create"
  | "mail.send"
  | "sprintTimeline.read"
  | "sprintTimeline.prioritize";

export type AnimaUserContext = {
  userId: string;
  displayName?: string | null;
  fullName?: string | null;
  email?: string | null;
  phone?: string | null;
  bio?: string | null;
  role?: string | null;
  isAuthenticated: boolean;
};

export type AnimaRecentTurn = {
  role: "user" | "assistant";
  text: string;
};

export type AnimaSessionInput = {
  userId: string;
  message: string;
  channel: AnimaChannel;
  language?: "it" | "en";
  sessionId?: string | null;
  recentTurns?: AnimaRecentTurn[];
  user?: Partial<AnimaUserContext>;
  auth?: {
    role?: string | null;
    isAdmin?: boolean;
    keyScopes?: Partial<Record<string, Partial<Record<string, string[]>>>>;
  };
  debugOptions?: {
    eventTypeResolver?: "includes" | "catalog_tokens";
  };
};

export type AnimaContext = {
  session: {
    userId: string;
    sessionId: string;
    channel: AnimaChannel;
    language: "it" | "en";
  };
  user: AnimaUserContext;
  auth?: AnimaSessionInput["auth"];
  debugOptions?: AnimaSessionInput["debugOptions"];
  capabilities: AnimaCapability[];
  recentTurns: AnimaRecentTurn[];
  input: {
    message: string;
  };
};

export type AnimaReply = {
  text: string;
};

export type AnimaLlmTraceStep = {
  id: string;
  step:
    | "operationSwitcher"
    | "senseInterpreter"
    | "emotionalEvaluator"
    | "catalogResolver"
    | "operationContextFiller.create"
    | "operationContextFiller.eventList"
    | "operationContextFiller.sprintTimelineRead"
    | "operationContextFiller.anagraficheRead"
    | "operationContextFiller.anagraficheCreate"
    | "operationContextFiller.mailFollowup"
    | "operationContextFiller.genericMail"
    | "taskAdvisor"
    | "responseComposer.orangeGuardrail"
    | "responseComposer.welcome"
    | "responseComposer.operationClarification"
    | "responseComposer.finalResponse"
    | "shortTermMemorySummarizer"
    | "mailComposer";
  title: string;
  reason: string;
  provider: "groq" | "glm";
  model: string | null;
  usage?: {
    inputTokens?: number | null;
    outputTokens?: number | null;
    totalTokens?: number | null;
  } | null;
  purpose?: string | null;
  systemPrompt: string;
  input: Record<string, unknown>;
  rawResponse: string | null;
  parsedResponse?: unknown;
  status: "success" | "failed";
  error?: string | null;
};

export type AnimaRunResult = {
  ok: true;
  reply: AnimaReply;
  context: AnimaContext;
  meta: {
    strategy:
      | "fallback_chat"
      | "event_discovery"
      | "event_recent_summary"
      | "event_list"
      | "event_list_clarification"
      | "event_create"
      | "event_create_clarification"
      | "mail_clarification"
      | "mail_reminder_sent"
      | "anagrafiche_read"
      | "anagrafiche_query_clarification"
      | "anagrafiche_create"
      | "anagrafiche_create_clarification"
      | "anagrafiche_create_denied"
      | "sprint_timeline_active_today"
      | "sprint_timeline_due"
      | "sprint_timeline_my_day"
      | "sprint_timeline_query_clarification"
      | "sprint_timeline_priority_advice"
      | "welcome_greeting"
      | "not_understood"
      | "low_value_guardrail"
      | "reminder_guardrail";
    usedCapabilities: AnimaCapability[];
    debug?: Record<string, any>;
  };
};
