// src/utils/doc-utils.ts
import type { DocType, DocumentCategory } from "@/server-utils/models/Document";

export function mimeToDocType(mime?: string | null): DocType {
  const m = mime || "";
  if (m.includes("pdf")) return "pdf";
  if (m.startsWith("image/")) return "image";
  if (m.includes("word") || m.endsWith("officedocument.wordprocessingml.document")) return "docx";
  if (m.includes("excel") || m.endsWith("officedocument.spreadsheetml.sheet")) return "xlsx";
  if (m.startsWith("text/")) return "txt";
  return "other";
}

export function extFromFilename(name: string): string {
  const i = name.lastIndexOf(".");
  return i >= 0 ? name.slice(i + 1).toLowerCase() : "bin";
}

export function inferCategoryFromName(name: string): string {
  const n = (name || "").toLowerCase();
  if (n.includes("conferma") || n.includes("ordine") || n.includes("order")) return "confermaOrdine";
  if (n.includes("certific")) return "certificatoMedico";
  return "documentoTecnico";
}
