// src/store/models/documents.ts
import { platformConfig } from "@/config/platform.config";

/** Tipi base */
export type Visibility = "personal" | "public";
export type DocType = "pdf" | "image" | "docx" | "xlsx" | "txt" | "other";
export type DocumentCategory = (typeof platformConfig.documentTypes)[number];

/** Item che usi in UI */
export type DocumentItem = {
  id: string;
  title: string;
  type: DocType;
  visibility: Visibility;
  sizeKB: number;
  updatedAt: string; // ISO
  owner: { id: string; name: string };
  url?: string;
  thumbnailUrl?: string;
  summary?: string | null;
  category: DocumentCategory;
};

/** Payload per upload */
export type UploadDocumentPayload = {
  file: File;
  title?: string;
  visibility?: Visibility;              // default "personal" lato API se omesso
  summary?: string | null;
  ownerId?: string | null;              // admin quando visibilità "personal"
  category?: "auto" | DocumentCategory; // selezione categoria
};
