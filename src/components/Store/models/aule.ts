// src/store/models/aule.ts

export type AulaPreview = {
  id: string;
  tipo: string;                // slug aula (es. "corsi-atleti")
  label: string;               // label dal config
  anagraficaType: string;      // slug anagrafica collegata
  numeroPartecipanti: number;
  ownerName?: string;
  visibilityRole?: string | null;
};

export type AulaPartecipanteDetail = {
  anagraficaId: string;
  joinedAt: string;            // ISO string
  dati: Record<string, any>;
};

export type DocumentLight = {
  id: string;
  title: string | null;
  category: string | null;
  updatedAt?: string | null;
  visibility?: string | null;
};

export type AttachmentView = {
  _id: string;
  type: string;
  uploadedAt: string | null;
  documentId: string;
  document?: DocumentLight | null;
  note?: string | null;
};

export type AulaDetail = AulaPreview & {
  campi: Record<string, any>;
  partecipanti: AulaPartecipanteDetail[];
  maestri: { id: string; name: string }[];
  attachments?: AttachmentView[];
};

export type AulaBucketState = {
  status: "idle" | "loading" | "succeeded" | "failed";
  items: AulaPreview[];
  total?: number;
  error?: string | null;
};

export type AuleState = {
  byType: Record<string, AulaBucketState>;
  current?: AulaDetail | null;
  currentStatus: "idle" | "loading" | "succeeded" | "failed";
  currentError?: string | null;
};
