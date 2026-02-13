// src/components/Store/models/anagrafiche.ts

export type AnagraficaPreview = {
  id: string;
  data: Record<string, any>;
  displayName: string;
  subtitle: string | null;
  updatedAt: string;

  /**
   * NEW (allineato al backend):
   * - in Atlas la visibilità è un array (roles) sul documento.
   */
  visibilityRoles?: string[];

  ownerId?: string | null;
  ownerName?: string | null;
};

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

export type AnagraficaFull = {
  id: string;
  data: Record<string, any>;

  visibilityRoles?: string[];

  attachments?: AttachmentView[];
  createdAt?: string;
  updatedAt?: string;
};
