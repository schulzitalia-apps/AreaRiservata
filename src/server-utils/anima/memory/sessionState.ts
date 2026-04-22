import { connectToDatabase } from "@/server-utils/lib/mongoose-connection";
import { AnimaMemoryModel } from "@/server-utils/anima-mini/animaMemory";

export type PendingMailFollowupState = {
  operation: "mail_followup";
  phase?: "confirm_send" | "ready";
  readiness?: "collecting" | "ready";
  data: {
    defaultTo?: string | null;
    selectedTo?: string | null;
    templateKey?: string | null;
    subjectHint?: string | null;
    intro?: string | null;
    userGoal?: string | null;
    eventTypeLabel?: string | null;
    title?: string | null;
    startAt?: string | null;
    endAt?: string | null;
    notes?: string | null;
  };
  missing: string[];
  updatedAt: string;
};

export type PendingGenericMailState = {
  operation: "generic_mail";
  phase?: "collect_recipient" | "collect_message" | "ready";
  readiness?: "collecting" | "ready";
  data: {
    to?: string | null;
    subject?: string | null;
    message?: string | null;
  };
  missing: string[];
  updatedAt: string;
};

export type PendingCreateState = {
  operation: "event_create";
  phase?:
    | "collect_type"
    | "collect_time"
    | "collect_title"
    | "collect_notes"
    | "ready";
  readiness?: "collecting" | "ready";
  data: {
    eventTypeSlug?: string | null;
    eventTypeLabel?: string | null;
    title?: string | null;
    notes?: string | null;
    startAt?: string | null;
    endAt?: string | null;
    timeKind?: string | null;
    startHour?: number | null;
    startMinute?: number | null;
    endHour?: number | null;
    endMinute?: number | null;
  };
  missing: string[];
  updatedAt: string;
};

export type PendingEventListState = {
  operation: "event_list";
  phase?: "collect_filters" | "ready";
  readiness?: "collecting" | "ready";
  data: {
    eventTypeSlug?: string | null;
    eventTypeLabel?: string | null;
    days?: number | null;
    futureDays?: number | null;
    specificDate?: string | null;
    timeFrom?: string | null;
    timeTo?: string | null;
    query?: string | null;
    limit?: number | null;
    wantsAll?: boolean | null;
  };
  missing: string[];
  updatedAt: string;
};

export type PendingSprintTimelineReadState = {
  operation: "sprint_timeline_read";
  phase?: "collect_scope" | "collect_signal" | "collect_priority" | "collect_due_window" | "collect_task" | "ready";
  readiness?: "collecting" | "ready";
  data: {
    mode?:
      | "active_tasks"
      | "due_tasks"
      | "priority_advice"
      | "owner_overview"
      | "delay_overview"
      | "task_breakdown"
      | null;
    scope?: "company" | "me_owner" | "me_reviewer" | "person" | null;
    personNames?: string[] | null;
    signals?: Array<"red" | "yellow" | "purple" | "blue" | "orange"> | null;
    priority?: "urgent" | "high" | "medium" | "low" | null;
    dueWithinDays?: number | null;
    taskQuery?: string | null;
    aggregateByOwner?: boolean | null;
  };
  missing: string[];
  updatedAt: string;
};

export type PendingAnagraficheReadState = {
  operation: "anagrafiche_read";
  phase?:
    | "collect_type"
    | "collect_query"
    | "collect_record"
    | "collect_fields"
    | "ready";
  readiness?: "collecting" | "ready";
  data: {
    typeSlug?: string | null;
    typeLabel?: string | null;
    query?: string | null;
    requestedFields?: string[] | null;
    wantsList?: boolean | null;
    selectedRecordId?: string | null;
    selectedRecordLabel?: string | null;
    candidateItems?: Array<{
      id: string;
      displayName: string;
      subtitle?: string | null;
    }> | null;
  };
  missing: string[];
  updatedAt: string;
};

export type PendingAnagraficheCreateState = {
  operation: "anagrafiche_create";
  phase?:
    | "collect_type"
    | "collect_data"
    | "confirm_write"
    | "ready";
  readiness?: "collecting" | "ready";
  data: {
    typeSlug?: string | null;
    typeLabel?: string | null;
    draftData?: Record<string, unknown> | null;
    suggestedFields?: string[] | null;
    confirmWrite?: boolean | null;
  };
  missing: string[];
  updatedAt: string;
};

export type PendingOperationState =
  | PendingCreateState
  | PendingEventListState
  | PendingSprintTimelineReadState
  | PendingAnagraficheReadState
  | PendingAnagraficheCreateState
  | PendingMailFollowupState
  | PendingGenericMailState;

function normalizePendingCreateState(raw: any): PendingCreateState | null {
  const operation = raw?.operation ?? raw?.kind;
  if (operation !== "event_create") return null;

  const sourceData = raw?.data ?? raw?.payload;

  return {
    operation: "event_create",
    phase:
      raw?.phase === "collect_type" ||
      raw?.phase === "collect_time" ||
      raw?.phase === "collect_title" ||
      raw?.phase === "collect_notes" ||
      raw?.phase === "ready"
        ? raw.phase
        : undefined,
    readiness: raw?.readiness === "ready" ? "ready" : "collecting",
    data: {
      eventTypeSlug: sourceData?.eventTypeSlug ?? null,
      eventTypeLabel: sourceData?.eventTypeLabel ?? null,
      title: sourceData?.title ?? null,
      notes: sourceData?.notes ?? null,
      startAt: sourceData?.startAt ?? null,
      endAt: sourceData?.endAt ?? null,
      timeKind: sourceData?.timeKind ?? null,
      startHour:
        typeof sourceData?.startHour === "number" ? sourceData.startHour : null,
      startMinute:
        typeof sourceData?.startMinute === "number"
          ? sourceData.startMinute
          : null,
      endHour:
        typeof sourceData?.endHour === "number" ? sourceData.endHour : null,
      endMinute:
        typeof sourceData?.endMinute === "number" ? sourceData.endMinute : null,
    },
    missing: Array.isArray(raw?.missing) ? raw.missing : [],
    updatedAt: raw?.updatedAt
      ? new Date(raw.updatedAt).toISOString()
      : new Date().toISOString(),
  };
}

function normalizePendingMailFollowupState(
  raw: any,
): PendingMailFollowupState | null {
  if (raw?.operation !== "mail_followup") return null;

  return {
    operation: "mail_followup",
    phase:
      raw?.phase === "confirm_send" || raw?.phase === "ready"
        ? raw.phase
        : "confirm_send",
    readiness: raw?.readiness === "ready" ? "ready" : "collecting",
    data: {
      defaultTo: raw?.data?.defaultTo ?? null,
      selectedTo: raw?.data?.selectedTo ?? null,
      templateKey: raw?.data?.templateKey ?? null,
      subjectHint: raw?.data?.subjectHint ?? null,
      intro: raw?.data?.intro ?? null,
      userGoal: raw?.data?.userGoal ?? null,
      eventTypeLabel: raw?.data?.eventTypeLabel ?? null,
      title: raw?.data?.title ?? null,
      startAt: raw?.data?.startAt ?? null,
      endAt: raw?.data?.endAt ?? null,
      notes: raw?.data?.notes ?? null,
    },
    missing: Array.isArray(raw?.missing) ? raw.missing : [],
    updatedAt: raw?.updatedAt
      ? new Date(raw.updatedAt).toISOString()
      : new Date().toISOString(),
  };
}

function normalizePendingEventListState(
  raw: any,
): PendingEventListState | null {
  if (raw?.operation !== "event_list") return null;

  return {
    operation: "event_list",
    phase: raw?.phase === "ready" ? "ready" : "collect_filters",
    readiness: raw?.readiness === "ready" ? "ready" : "collecting",
    data: {
      eventTypeSlug: raw?.data?.eventTypeSlug ?? null,
      eventTypeLabel: raw?.data?.eventTypeLabel ?? null,
      days: typeof raw?.data?.days === "number" ? raw.data.days : null,
      futureDays:
        typeof raw?.data?.futureDays === "number" ? raw.data.futureDays : null,
      specificDate: raw?.data?.specificDate ?? null,
      timeFrom: raw?.data?.timeFrom ?? null,
      timeTo: raw?.data?.timeTo ?? null,
      query: raw?.data?.query ?? null,
      limit: typeof raw?.data?.limit === "number" ? raw.data.limit : null,
      wantsAll: raw?.data?.wantsAll === true,
    },
    missing: Array.isArray(raw?.missing) ? raw.missing : [],
    updatedAt: raw?.updatedAt
      ? new Date(raw.updatedAt).toISOString()
      : new Date().toISOString(),
  };
}

function normalizePendingGenericMailState(
  raw: any,
): PendingGenericMailState | null {
  if (raw?.operation !== "generic_mail") return null;

  return {
    operation: "generic_mail",
    phase:
      raw?.phase === "collect_recipient" ||
      raw?.phase === "collect_message" ||
      raw?.phase === "ready"
        ? raw.phase
        : "collect_message",
    readiness: raw?.readiness === "ready" ? "ready" : "collecting",
    data: {
      to: raw?.data?.to ?? null,
      subject: raw?.data?.subject ?? raw?.data?.subjectHint ?? null,
      message:
        raw?.data?.message ??
        raw?.data?.bodyHint ??
        raw?.data?.userGoal ??
        null,
    },
    missing: Array.isArray(raw?.missing) ? raw.missing : [],
    updatedAt: raw?.updatedAt
      ? new Date(raw.updatedAt).toISOString()
      : new Date().toISOString(),
  };
}

function normalizePendingSprintTimelineReadState(
  raw: any,
): PendingSprintTimelineReadState | null {
  if (raw?.operation !== "sprint_timeline_read") return null;

  const validSignals = ["red", "yellow", "purple", "blue", "orange"];
  const rawSignals = Array.isArray(raw?.data?.signals) ? raw.data.signals : [];

  return {
    operation: "sprint_timeline_read",
    phase:
      raw?.phase === "collect_scope" ||
      raw?.phase === "collect_signal" ||
      raw?.phase === "collect_priority" ||
      raw?.phase === "collect_due_window" ||
      raw?.phase === "collect_task" ||
      raw?.phase === "ready"
        ? raw.phase
        : "collect_scope",
    readiness: raw?.readiness === "ready" ? "ready" : "collecting",
    data: {
      mode:
        raw?.data?.mode === "active_tasks" ||
        raw?.data?.mode === "due_tasks" ||
        raw?.data?.mode === "priority_advice" ||
        raw?.data?.mode === "owner_overview" ||
        raw?.data?.mode === "delay_overview" ||
        raw?.data?.mode === "task_breakdown"
          ? raw.data.mode
          : null,
      scope:
        raw?.data?.scope === "company" ||
        raw?.data?.scope === "me_owner" ||
        raw?.data?.scope === "me_reviewer" ||
        raw?.data?.scope === "person"
          ? raw.data.scope
          : null,
      personNames: Array.isArray(raw?.data?.personNames)
        ? raw.data.personNames.map((item: unknown) => String(item)).filter(Boolean)
        : null,
      signals: rawSignals.filter((signal: unknown) =>
        validSignals.includes(String(signal)),
      ) as Array<"red" | "yellow" | "purple" | "blue" | "orange">,
      priority:
        raw?.data?.priority === "urgent" ||
        raw?.data?.priority === "high" ||
        raw?.data?.priority === "medium" ||
        raw?.data?.priority === "low"
          ? raw.data.priority
          : null,
      dueWithinDays:
        typeof raw?.data?.dueWithinDays === "number" ? raw.data.dueWithinDays : null,
      taskQuery:
        typeof raw?.data?.taskQuery === "string" ? raw.data.taskQuery : null,
      aggregateByOwner: raw?.data?.aggregateByOwner === true,
    },
    missing: Array.isArray(raw?.missing) ? raw.missing : [],
    updatedAt: raw?.updatedAt
      ? new Date(raw.updatedAt).toISOString()
      : new Date().toISOString(),
  };
}

function normalizePendingAnagraficheReadState(
  raw: any,
): PendingAnagraficheReadState | null {
  const operation = raw?.operation ?? raw?.kind;
  const sourceData = raw?.data ?? raw?.payload;
  if (operation !== "anagrafiche_read") return null;

  return {
    operation: "anagrafiche_read",
    phase:
      raw?.phase === "collect_type" ||
      raw?.phase === "collect_query" ||
      raw?.phase === "collect_record" ||
      raw?.phase === "collect_fields" ||
      raw?.phase === "ready"
        ? raw.phase
        : "collect_type",
    readiness: raw?.readiness === "ready" ? "ready" : "collecting",
    data: {
      typeSlug: sourceData?.typeSlug ?? null,
      typeLabel: sourceData?.typeLabel ?? null,
      query: sourceData?.query ?? null,
      requestedFields: Array.isArray(sourceData?.requestedFields)
        ? sourceData.requestedFields
            .map((item: unknown) => String(item))
            .filter(Boolean)
        : null,
      wantsList: sourceData?.wantsList === true,
      selectedRecordId: sourceData?.selectedRecordId ?? null,
      selectedRecordLabel: sourceData?.selectedRecordLabel ?? null,
      candidateItems: Array.isArray(sourceData?.candidateItems)
        ? sourceData.candidateItems
            .map((item: any) => ({
              id: String(item?.id ?? "").trim(),
              displayName: String(item?.displayName ?? "").trim(),
              subtitle:
                item?.subtitle == null ? null : String(item.subtitle).trim(),
            }))
            .filter((item: any) => item.id && item.displayName)
        : null,
    },
    missing: Array.isArray(raw?.missing) ? raw.missing : [],
    updatedAt: raw?.updatedAt
      ? new Date(raw.updatedAt).toISOString()
      : new Date().toISOString(),
  };
}

function normalizePendingAnagraficheCreateState(
  raw: any,
): PendingAnagraficheCreateState | null {
  const operation = raw?.operation ?? raw?.kind;
  const sourceData = raw?.data ?? raw?.payload;
  if (operation !== "anagrafiche_create") return null;

  return {
    operation: "anagrafiche_create",
    phase:
      raw?.phase === "collect_type" ||
      raw?.phase === "collect_data" ||
      raw?.phase === "confirm_write" ||
      raw?.phase === "ready"
        ? raw.phase
        : "collect_type",
    readiness: raw?.readiness === "ready" ? "ready" : "collecting",
    data: {
      typeSlug: sourceData?.typeSlug ?? null,
      typeLabel: sourceData?.typeLabel ?? null,
      draftData:
        sourceData?.draftData && typeof sourceData.draftData === "object"
          ? sourceData.draftData
          : null,
      suggestedFields: Array.isArray(sourceData?.suggestedFields)
        ? sourceData.suggestedFields.map((item: unknown) => String(item)).filter(Boolean)
        : null,
      confirmWrite: sourceData?.confirmWrite === true,
    },
    missing: Array.isArray(raw?.missing) ? raw.missing : [],
    updatedAt: raw?.updatedAt
      ? new Date(raw.updatedAt).toISOString()
      : new Date().toISOString(),
  };
}

export async function loadPendingOperationState(
  sessionId: string,
): Promise<PendingOperationState | null> {
  if (!sessionId) return null;

  await connectToDatabase();
  const doc = await AnimaMemoryModel.findById(sessionId).lean();

  return (
    normalizePendingCreateState(doc?.operationState) ??
    normalizePendingEventListState(doc?.operationState) ??
    normalizePendingSprintTimelineReadState(doc?.operationState) ??
    normalizePendingAnagraficheReadState(doc?.operationState) ??
    normalizePendingAnagraficheCreateState(doc?.operationState) ??
    normalizePendingMailFollowupState(doc?.operationState) ??
    normalizePendingGenericMailState(doc?.operationState) ??
    normalizePendingAnagraficheReadState(doc?.taskState) ??
    normalizePendingAnagraficheCreateState(doc?.taskState) ??
    normalizePendingCreateState(doc?.taskState)
  );
}

export async function loadPendingCreateState(
  sessionId: string,
): Promise<PendingCreateState | null> {
  const state = await loadPendingOperationState(sessionId);
  return state?.operation === "event_create" ? state : null;
}

export async function savePendingCreateState(
  sessionId: string,
  state: PendingCreateState,
): Promise<void> {
  if (!sessionId) return;

  await connectToDatabase();
  await AnimaMemoryModel.updateOne(
    { _id: sessionId },
    {
      $set: {
        operationState: {
          operation: state.operation,
          phase: state.phase ?? null,
          readiness: state.readiness ?? "collecting",
          data: state.data,
          missing: state.missing,
          updatedAt: new Date(state.updatedAt),
        },
        taskState: {
          kind: state.operation,
          phase: state.phase ?? null,
          payload: state.data,
          missing: state.missing,
          updatedAt: new Date(state.updatedAt),
        },
      },
    },
    { upsert: true },
  );
}

export async function savePendingMailFollowupState(
  sessionId: string,
  state: PendingMailFollowupState,
): Promise<void> {
  if (!sessionId) return;

  await connectToDatabase();
  await AnimaMemoryModel.updateOne(
    { _id: sessionId },
    {
      $set: {
        operationState: {
          operation: state.operation,
          phase: state.phase ?? "confirm_send",
          readiness: state.readiness ?? "collecting",
          data: state.data,
          missing: state.missing,
          updatedAt: new Date(state.updatedAt),
        },
        taskState: {
          kind: state.operation,
          phase: state.phase ?? "collect_filters",
          payload: state.data,
          missing: state.missing,
          updatedAt: new Date(state.updatedAt),
        },
      },
    },
    { upsert: true },
  );
}

export async function savePendingEventListState(
  sessionId: string,
  state: PendingEventListState,
): Promise<void> {
  if (!sessionId) return;

  await connectToDatabase();
  await AnimaMemoryModel.updateOne(
    { _id: sessionId },
    {
      $set: {
        operationState: {
          operation: state.operation,
          phase: state.phase ?? "collect_filters",
          readiness: state.readiness ?? "collecting",
          data: state.data,
          missing: state.missing,
          updatedAt: new Date(state.updatedAt),
        },
      },
    },
    { upsert: true },
  );
}

export async function savePendingSprintTimelineReadState(
  sessionId: string,
  state: PendingSprintTimelineReadState,
): Promise<void> {
  if (!sessionId) return;

  await connectToDatabase();
  await AnimaMemoryModel.updateOne(
    { _id: sessionId },
    {
      $set: {
        operationState: {
          operation: state.operation,
          phase: state.phase ?? "collect_scope",
          readiness: state.readiness ?? "collecting",
          data: state.data,
          missing: state.missing,
          updatedAt: new Date(state.updatedAt),
        },
        taskState: {
          kind: state.operation,
          phase: state.phase ?? "collect_scope",
          payload: state.data,
          missing: state.missing,
          updatedAt: new Date(state.updatedAt),
        },
      },
    },
    { upsert: true },
  );
}

export async function savePendingAnagraficheReadState(
  sessionId: string,
  state: PendingAnagraficheReadState,
): Promise<void> {
  if (!sessionId) return;

  await connectToDatabase();
  await AnimaMemoryModel.updateOne(
    { _id: sessionId },
    {
      $set: {
        operationState: {
          operation: state.operation,
          phase: state.phase ?? "collect_type",
          readiness: state.readiness ?? "collecting",
          data: state.data,
          missing: state.missing,
          updatedAt: new Date(state.updatedAt),
        },
        taskState: {
          kind: state.operation,
          phase: state.phase ?? "collect_type",
          payload: state.data,
          missing: state.missing,
          updatedAt: new Date(state.updatedAt),
        },
      },
    },
    { upsert: true },
  );
}

export async function savePendingAnagraficheCreateState(
  sessionId: string,
  state: PendingAnagraficheCreateState,
): Promise<void> {
  if (!sessionId) return;

  await connectToDatabase();
  await AnimaMemoryModel.updateOne(
    { _id: sessionId },
    {
      $set: {
        operationState: {
          operation: state.operation,
          phase: state.phase ?? "collect_type",
          readiness: state.readiness ?? "collecting",
          data: state.data,
          missing: state.missing,
          updatedAt: new Date(state.updatedAt),
        },
        taskState: {
          kind: state.operation,
          phase: state.phase ?? "collect_type",
          payload: state.data,
          missing: state.missing,
          updatedAt: new Date(state.updatedAt),
        },
      },
    },
    { upsert: true },
  );
}

export async function savePendingGenericMailState(
  sessionId: string,
  state: PendingGenericMailState,
): Promise<void> {
  if (!sessionId) return;

  await connectToDatabase();
  await AnimaMemoryModel.updateOne(
    { _id: sessionId },
    {
      $set: {
        operationState: {
          operation: state.operation,
          phase: state.phase ?? "collect_message",
          readiness: state.readiness ?? "collecting",
          data: state.data,
          missing: state.missing,
          updatedAt: new Date(state.updatedAt),
        },
      },
    },
    { upsert: true },
  );
}

export async function clearOperationState(sessionId: string): Promise<void> {
  if (!sessionId) return;

  await connectToDatabase();
  await AnimaMemoryModel.updateOne(
    { _id: sessionId },
    { $set: { operationState: null, taskState: null } },
    { upsert: true },
  );
}

export async function clearPendingCreateState(
  sessionId: string,
): Promise<void> {
  await clearOperationState(sessionId);
}
