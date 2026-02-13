// src/config/barcode.config.ts
import type { AnagraficaTypeSlug } from "@/config/anagrafiche.types.public";
import type { FieldKey } from "@/config/anagrafiche.fields.catalog";

export type BarcodeExtract =
  | { kind: "slice"; start: number; len: number }
  | { kind: "regex"; pattern: string; group?: number };

export type BarcodeUpdateActionConfig = {
  kind: "anagrafica_update";
  targetType: AnagraficaTypeSlug;

  /**
   * 1) cerco nel "report" /api/anagrafiche/:type?query=...
   * 2) per scegliere il record giusto faccio GET /api/anagrafiche/:type/:id
   *    e controllo che data[matchField] === extractedValue
   */
  matchField: FieldKey;
  extractedFromBarcode: BarcodeExtract;

  /**
   * PATCH /api/anagrafiche/:type/:id con body { data: { [setField]: setValue } }
   */
  setField: FieldKey;
  setValue: string | number | boolean | null;
};

export type BarcodeReadOnlyActionConfig = {
  kind: "read_only";
};

export type BarcodeActionConfig = {
  id: string;
  label: string;
  description?: string;
  action: BarcodeReadOnlyActionConfig | BarcodeUpdateActionConfig;
};

export const BARCODE_ACTIONS_CONFIG = [
  {
    id: "lettura",
    label: "Lettura",
    description: "Solo lettura (nessuna operazione).",
    action: { kind: "read_only" },
  },

  // ESEMPIO: prime 5 cifre = "commessa"/numeroOrdine, aggiorno statoAvanzamento
  {
    id: "taglio",
    label: "Taglio",
    description: "Imposta lo stato avanzamento a Taglio sulla conferma d'ordine trovata.",
    action: {
      kind: "anagrafica_update",
      targetType: "conferme-ordine",
      matchField: "numeroOrdine",
      extractedFromBarcode: { kind: "slice", start: 0, len: 5 },
      setField: "statoAvanzamento",
      setValue: "Taglio",
    },
  },
  {
    id: "vetraggio",
    label: "Vetraggio",
    description: "Imposta lo stato avanzamento a Vetraggio sulla conferma d'ordine trovata.",
    action: {
      kind: "anagrafica_update",
      targetType: "conferme-ordine",
      matchField: "numeroOrdine",
      extractedFromBarcode: { kind: "slice", start: 0, len: 5 },
      setField: "statoAvanzamento",
      setValue: "Vetraggio",
    },
  },
  {
    id: "ferramenta",
    label: "Ferramenta",
    description: "Imposta lo stato avanzamento a Ferramenta sulla conferma d'ordine trovata.",
    action: {
      kind: "anagrafica_update",
      targetType: "conferme-ordine",
      matchField: "numeroOrdine",
      extractedFromBarcode: { kind: "slice", start: 0, len: 5 },
      setField: "statoAvanzamento",
      setValue: "Ferramenta",
    },
  },
  {
    id: "imballaggio",
    label: "Imballaggio",
    description: "Imposta lo stato avanzamento a Imballaggio sulla conferma d'ordine trovata.",
    action: {
      kind: "anagrafica_update",
      targetType: "conferme-ordine",
      matchField: "numeroOrdine",
      extractedFromBarcode: { kind: "slice", start: 0, len: 5 },
      setField: "statoAvanzamento",
      setValue: "Imballaggio",
    },
  },
  {
    id: "spedizione",
    label: "Spedizione",
    description: "Imposta lo stato avanzamento a Spedizione sulla conferma d'ordine trovata.",
    action: {
      kind: "anagrafica_update",
      targetType: "conferme-ordine",
      matchField: "numeroOrdine",
      extractedFromBarcode: { kind: "slice", start: 0, len: 5 },
      setField: "statoAvanzamento",
      setValue: "Spedizione",
    },
  },
] as const satisfies readonly BarcodeActionConfig[];

export type BarcodeActionId = (typeof BARCODE_ACTIONS_CONFIG)[number]["id"];

export function getBarcodeActionConfig(id: BarcodeActionId | string): BarcodeActionConfig | null {
  return (BARCODE_ACTIONS_CONFIG as readonly BarcodeActionConfig[]).find((a) => a.id === id) ?? null;
}

export function listBarcodeActions() {
  return BARCODE_ACTIONS_CONFIG as readonly BarcodeActionConfig[];
}
