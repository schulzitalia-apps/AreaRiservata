import { Schema, Types, Document as MDoc } from "mongoose";

/* ------------------------------------------------------------------ */
/*                         DISPLAY TYPES                              */
/* ------------------------------------------------------------------ */

export type UnitSpec = {
  kind: "prefix" | "suffix";
  value: string; // es. "€" (prefix), "%" (suffix), "kg" (suffix)
};

export type NumberFormat =
  | "plain"     // 1234.56
  | "integer"   // 1235
  | "decimal"   // 1234.56 (con decimals)
  | "compact"   // 1.2K / 3.4M (con decimals)
  | "currency"  // € 1.234,56 (con currency)
  | "percent";  // 15% (con percentBasis)

export type DateTimeFormat =
  | "date"        // 27/01/2026
  | "time"        // 14:35
  | "datetime"    // 27/01/2026 14:35
  | "monthYear"   // 01/2026
  | "relative"    // "2 giorni fa"
  | "iso";        // 2026-01-27T...

export type TextFormat =
  | "text"        // testo normale
  | "longtext"    // testo lungo / multiline
  | "label"       // etichetta / badge
  | "link"        // URL
  | "email"       // mailto:
  | "phone";      // tel:

export type ReferenceFormat = "reference";

export type DisplayKind = "number" | "datetime" | "text" | "reference";

export type DisplayFormat =
  | NumberFormat
  | DateTimeFormat
  | TextFormat
  | ReferenceFormat;

/**
 * Override di visualizzazione per un singolo campo, dentro una variant.
 * (Esempio: "sconto" => percent + "%" ; "costoUnitario" => currency + "€")
 */
export type FieldOverride = {
  kind: DisplayKind;
  format: DisplayFormat;

  /** SOLO per number */
  unit?: UnitSpec;
  decimals?: number;

  /**
   * percentBasis:
   * - "whole": 15 => 15%
   * - "fraction": 0.15 => 15%
   */
  percentBasis?: "whole" | "fraction";

  /**
   * currency: ISO 4217 (EUR, USD...)
   * (se format !== "currency" puoi ignorarlo)
   */
  currency?: string;

  /** eventuale label override (solo UI) */
  label?: string;
};

/* ------------------------------------------------------------------ */
/*                         DOMAIN MODEL                               */
/* ------------------------------------------------------------------ */

export interface IVariantConfigDoc extends MDoc {
  _id: Types.ObjectId;

  anagraficaSlug: string; // es. "clienti"
  variantId: string;      // es. "b2b", "fast", "print3d"
  label: string;          // nome user friendly

  /**
   * Campi inclusi nella variante (subset dei fields di quello slug)
   */
  includeFields: string[];

  /**
   * Override di visualizzazione per campo:
   *   fieldOverrides["costoUnitario"] = { kind:"number", format:"currency", currency:"EUR", unit:{kind:"prefix", value:"€"} }
   */
  fieldOverrides: Record<string, FieldOverride>;

  // ACL / Audit (opzionale ma utile)
  createdBy?: Types.ObjectId | null;
  updatedBy?: Types.ObjectId | null;

  createdAt: Date;
  updatedAt: Date;
}

const unitSchema = new Schema<UnitSpec>(
  {
    kind: { type: String, enum: ["prefix", "suffix"], required: true },
    value: { type: String, required: true, trim: true, maxlength: 20 },
  },
  { _id: false },
);

const fieldOverrideSchema = new Schema<FieldOverride>(
  {
    kind: {
      type: String,
      enum: ["number", "datetime", "text", "reference"],
      required: true,
      index: true,
    },
    format: { type: String, required: true, trim: true, index: true },

    unit: { type: unitSchema, default: undefined },
    decimals: { type: Number, default: undefined, min: 0, max: 10 },

    percentBasis: {
      type: String,
      enum: ["whole", "fraction"],
      default: undefined,
    },

    currency: { type: String, default: undefined, trim: true, maxlength: 10 },

    label: { type: String, default: undefined, trim: true, maxlength: 200 },
  },
  { _id: false },
);

export function buildVariantConfigSchema() {
  const schema = new Schema<IVariantConfigDoc>(
    {
      anagraficaSlug: { type: String, required: true, trim: true, maxlength: 80, index: true },
      variantId: { type: String, required: true, trim: true, maxlength: 80, index: true },
      label: { type: String, required: true, trim: true, maxlength: 200 },

      includeFields: { type: [String], default: [], index: false },

      // Map non tipizzato rigidamente: noi validiamo lo shape con fieldOverrideSchema.
      // Mongoose Map => key string -> subdoc
      fieldOverrides: {
        type: Map,
        of: fieldOverrideSchema,
        default: () => ({}),
      },

      createdBy: { type: Schema.Types.ObjectId, ref: "User", default: null, index: true },
      updatedBy: { type: Schema.Types.ObjectId, ref: "User", default: null, index: true },
    },
    { timestamps: true },
  );

  // Unicità per slug + variantId
  schema.index({ anagraficaSlug: 1, variantId: 1 }, { unique: true });

  return schema;
}
