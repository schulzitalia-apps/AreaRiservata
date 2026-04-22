import mongoose, { Schema } from "mongoose";

export type AnimaMemoryDoc = {
  _id: string; // userId (es. "whatsapp:+39...")
  summary: string; // memoria sintetica
  conversationState?: {
    hasWelcomed?: boolean | null;
    stage?: "new" | "active" | null;
    updatedAt?: Date | null;
  } | null;
  operationState?: {
    operation?:
      | "event_create"
      | "event_list"
      | "mail_followup"
      | "generic_mail"
      | null;
    phase?:
      | "collect_type"
      | "collect_filters"
      | "collect_time"
      | "collect_title"
      | "collect_notes"
      | "confirm_send"
      | "collect_recipient"
      | "collect_goal"
      | "ready"
      | null;
    readiness?: "collecting" | "ready" | null;
    data?: {
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
      title?: string | null;
      notes?: string | null;
      startAt?: string | null;
      endAt?: string | null;
      timeKind?: string | null;
      defaultTo?: string | null;
      selectedTo?: string | null;
      templateKey?: string | null;
      subjectHint?: string | null;
      intro?: string | null;
      userGoal?: string | null;
      bodyHint?: string | null;
    } | null;
    missing?: string[] | null;
    updatedAt?: Date | null;
  } | null;
  taskState?: {
    kind?: "event_create" | "event_list" | null;
    phase?:
      | "collect_type"
      | "collect_filters"
      | "collect_time"
      | "collect_title"
      | "collect_notes"
      | "ready"
      | null;
    payload?: {
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
      title?: string | null;
      notes?: string | null;
      startAt?: string | null;
      endAt?: string | null;
      timeKind?: string | null;
    } | null;
    missing?: string[] | null;
    updatedAt?: Date | null;
  } | null;
  contactState?: {
    recentContacts?: Array<{
      recordId?: string | null;
      typeSlug?: string | null;
      typeLabel?: string | null;
      displayName?: string | null;
      emails?: string[] | null;
      phones?: string[] | null;
      updatedAt?: Date | null;
    }> | null;
  } | null;
  createdAt?: Date;
  updatedAt?: Date;
};

const AnimaMemorySchema = new Schema<AnimaMemoryDoc>(
  {
    _id: { type: String, required: true },
    summary: { type: String, default: "" },
    conversationState: {
      type: {
        hasWelcomed: { type: Boolean, default: false },
        stage: { type: String, default: "new" },
        updatedAt: { type: Date, default: null },
      },
      default: null,
    },
    operationState: {
      type: Schema.Types.Mixed,
      default: null,
    },
    taskState: {
      type: {
        kind: { type: String, default: null },
        phase: { type: String, default: null },
        payload: { type: Schema.Types.Mixed, default: null },
        missing: { type: [String], default: [] },
        updatedAt: { type: Date, default: null },
      },
      default: null,
    },
    contactState: {
      type: Schema.Types.Mixed,
      default: null,
    },
  },
  { timestamps: true },
);

export const AnimaMemoryModel =
  (mongoose.models.AnimaMemory as mongoose.Model<AnimaMemoryDoc>) ||
  mongoose.model<AnimaMemoryDoc>("AnimaMemory", AnimaMemorySchema);
