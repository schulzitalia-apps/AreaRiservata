import type { FieldKey } from "@/config/anagrafiche.fields.catalog";

export type AnagraficheReadQuery = {
  typeSlug?: string | null;
  typeLabel?: string | null;
  query?: string | null;
  requestedFields?: FieldKey[];
  wantsList?: boolean;
  selectedRecordId?: string | null;
  selectedRecordLabel?: string | null;
};

export type AnagraficheCreateQuery = {
  typeSlug?: string | null;
  typeLabel?: string | null;
  draftData?: Record<string, unknown>;
  suggestedFields?: FieldKey[];
  confirmWrite?: boolean;
};

export type AnagraficheReadIntent = {
  type: "anagrafiche_read";
  query: AnagraficheReadQuery;
  explanation: string;
  debug: {
    matchedBy: string;
  };
};

export type AnagraficheCreateIntent = {
  type: "anagrafiche_create";
  query: AnagraficheCreateQuery;
  explanation: string;
  debug: {
    matchedBy: string;
  };
};

export type AnagraficheListingPresentation = {
  mode: "verbatim_list" | "summarized";
  header: string;
  listBlock: string | null;
  summaryText: string | null;
  footer: string | null;
};

export type AnagraficheCandidateRecord = {
  id: string;
  displayName: string;
  subtitle?: string | null;
};

export type AnagraficheFieldValue = {
  key: FieldKey;
  label: string;
  value: string;
};

export type AnagraficheRecordSnapshot = {
  id: string;
  typeSlug: string;
  typeLabel: string;
  displayName: string;
  subtitle?: string | null;
  updatedAt: string;
  ownerName?: string | null;
  contactEmails?: string[];
  contactPhones?: string[];
  fields: AnagraficheFieldValue[];
};

export type AnagraficheReadResult = {
  header: string;
  text: string;
  total: number;
  items: AnagraficheRecordSnapshot[];
  presentation: AnagraficheListingPresentation;
};
