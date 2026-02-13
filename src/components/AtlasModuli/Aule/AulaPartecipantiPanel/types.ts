export type PartecipanteView = {
  anagraficaId: string;
  joinedAt?: string;
  dati?: Record<string, any>;
};

export type AulaViewMode = "overview" | "alerts" | "urgent";

export type AulaAlert = {
  id: string;
  title: string;
  description?: string;
  createdAt?: string;
};
