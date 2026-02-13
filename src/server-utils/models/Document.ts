import mongoose, { Schema, Types, Document as MDoc, Model } from "mongoose";
import { platformConfig } from "@/config/platform.config";

export type Visibility = "personal" | "public";
export type DocType = "pdf" | "image" | "docx" | "xlsx" | "txt" | "other";
export type DocumentCategory = typeof platformConfig.documentTypes[number];

export interface IDocument {
  title: string;
  type: DocType;
  visibility: Visibility;
  sizeBytes: number;
  summary?: string | null;
  mimeType?: string | null;
  r2Key: string;
  url?: string | null;
  thumbnailUrl?: string | null;
  category: DocumentCategory;
  ownerId?: Types.ObjectId | null;
  createdBy: Types.ObjectId;
}

export interface IDocumentDoc extends IDocument, MDoc {
  _id: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

// ✅ prendi le categorie dal config e loggale all’avvio (debug)
const ALLOWED_CATEGORIES: string[] = Array.from(platformConfig.documentTypes);
console.log("[DocumentModel] allowed categories:", ALLOWED_CATEGORIES);

const documentSchema = new Schema<IDocumentDoc>(
  {
    title: { type: String, required: true, trim: true, maxlength: 300 },
    type:  { type: String, enum: ["pdf", "image", "docx", "xlsx", "txt", "other"], required: true },
    visibility: { type: String, enum: ["personal", "public"], default: "personal", index: true },
    sizeBytes: { type: Number, required: true },
    summary:   { type: String, trim: true, maxlength: 5000, default: null },
    mimeType:  { type: String, default: null },
    r2Key:     { type: String, required: true },
    url:       { type: String, default: null },
    thumbnailUrl: { type: String, default: null },
    category: {
      type: String,
      enum: ALLOWED_CATEGORIES,  // 🔒 enum da config
      required: true,
      index: true,
    },
    ownerId:   { type: Schema.Types.ObjectId, ref: "User", default: null, index: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
  },
  { timestamps: true }
);

// guardrail extra (oltre all’enum)
documentSchema.pre("validate", function (next) {
  const self = this as IDocumentDoc;
  if (self.visibility === "personal" && !self.ownerId) {
    return next(new Error("ownerId richiesto per documenti personali"));
  }
  if (!self.category) return next(new Error("Category mancante"));
  if (!ALLOWED_CATEGORIES.includes(self.category)) {
    return next(new Error(`Category non valida: ${self.category}`));
  }
  next();
});

documentSchema.post("save", function (doc) {
  console.log("[Document.save] _id=%s category=%s", String(doc._id), doc.category);
});

// ❗️ bump del MODEL_NAME per forzare un nuovo model in memoria
const MODEL_NAME = "Document_v2";
const COLLECTION_NAME = "documents";

const DocumentModel: Model<IDocumentDoc> =
  (mongoose.models[MODEL_NAME] as Model<IDocumentDoc>) ||
  mongoose.model<IDocumentDoc>(MODEL_NAME, documentSchema, COLLECTION_NAME);

export default DocumentModel;
