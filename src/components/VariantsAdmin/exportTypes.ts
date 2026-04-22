export type ExportFormat = "csv" | "xls";
export type ExportSortDir = "asc" | "desc";

export type ExportVariantConfigDTO = {
  id: string;
  anagraficaSlug: string;
  variantId: string;
  label: string;
  format: ExportFormat;
  includeFields: string[];
  referenceExpansions: Record<string, string[]>;
  filterDateField: string | null;
  filterSelectField: string | null;
  sortDateField: string | null;
  sortDir: ExportSortDir;
  createdAt: string;
  updatedAt: string;
};

export type CreateExportVariantPayload = {
  variantId: string;
  label: string;
  format: ExportFormat;
  includeFields: string[];
  referenceExpansions?: Record<string, string[]>;
  filterDateField?: string | null;
  filterSelectField?: string | null;
  sortDateField?: string | null;
  sortDir?: ExportSortDir;
};

export type UpdateExportVariantPayload = {
  label?: string;
  format?: ExportFormat;
  includeFields?: string[];
  referenceExpansions?: Record<string, string[]>;
  filterDateField?: string | null;
  filterSelectField?: string | null;
  sortDateField?: string | null;
  sortDir?: ExportSortDir;
};
