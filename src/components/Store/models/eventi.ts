// Store/models/eventi.ts

// Manteniamo lo stesso DocumentLight usato altrove
export type DocumentLight = {
  id: string;
  title: string;
  category: string;
  updatedAt?: string | null;
};

export type AttachmentView = {
  _id: string;
  type: string;
  uploadedAt: string | null;
  documentId: string;
  document?: DocumentLight | null;
  note?: string | null;
};

export type TimeKind =
  | "point"
  | "interval"
  | "deadline"
  | "recurring_master"
  | "recurring_occurrence";

export type EventoRecurrenceView = {
  rrule?: string | null;
  until?: string | null;
  count?: number | null;
  masterId?: string | null;
};

export type EventoGruppoView = {
  gruppoType: string;
  gruppoId: string;
};

export type EventoPartecipanteView = {
  anagraficaType: string;
  anagraficaId: string;
  role?: string | null;
  status?: string | null;
  quantity?: number | null;
  note?: string | null;
};

export type EventoPreview = {
  id: string;
  displayName: string;
  subtitle: string | null;
  timeKind: TimeKind;
  startAt?: string | null;
  endAt?: string | null;
  updatedAt: string;
  visibilityRole?: string | null;
  ownerId?: string | null;
  ownerName?: string | null;
};

export type EventoFull = {
  id: string;
  data: Record<string, any>;
  timeKind: TimeKind;
  startAt?: string | null;
  endAt?: string | null;
  allDay?: boolean;

  recurrence?: EventoRecurrenceView | null;
  gruppo?: EventoGruppoView | null;
  partecipanti: EventoPartecipanteView[];

  visibilityRole?: string | null;
  attachments?: AttachmentView[];

  createdAt?: string;
  updatedAt?: string;
};
