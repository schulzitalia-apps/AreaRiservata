// src/server-utils/models/userResourceKey.ts
import mongoose, { Schema, Types, Document, Model } from "mongoose";

/**
 * Collegamento generico:
 *
 *  userId     → utente
 *  scopeKind  → dominio: "anagrafica", "aula", "evento", ...
 *  scopeSlug  → tipo specifico: "clienti", "cantieri", "avvisi", ...
 *  resourceId → _id del documento nella collection corrispondente
 */
export interface IUserResourceKey {
  userId: Types.ObjectId;
  scopeKind: string;   // es: "anagrafica", "aula", "evento", ...
  scopeSlug: string;   // es: "clienti", "cantieri", "avvisi", ...
  resourceId: Types.ObjectId;
}

/**
 * Documento Mongo completo con timestamp.
 * (timestamps: true nello schema aggiunge createdAt/updatedAt)
 */
export interface IUserResourceKeyDoc
  extends IUserResourceKey,
    Document {
  createdAt: Date;
  updatedAt: Date;
}

const userResourceKeySchema = new Schema<IUserResourceKeyDoc>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    scopeKind: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    scopeSlug: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    resourceId: {
      type: Schema.Types.ObjectId,
      required: true,
      index: true,
    },
  },
  { timestamps: true },
);

/**
 * Uno user non può avere due volte la stessa KEY
 * sullo stesso oggetto (kind+slug+resourceId).
 */
userResourceKeySchema.index(
  { userId: 1, scopeKind: 1, scopeSlug: 1, resourceId: 1 },
  { unique: true },
);

/**
 * Indice di comodo per filtrare per userId+scopeKind+scopeSlug.
 */
userResourceKeySchema.index(
  { userId: 1, scopeKind: 1, scopeSlug: 1 },
  { background: true },
);

const UserResourceKeyModel: Model<IUserResourceKeyDoc> =
  (mongoose.models.UserResourceKey as Model<IUserResourceKeyDoc>) ||
  mongoose.model<IUserResourceKeyDoc>(
    "UserResourceKey",
    userResourceKeySchema,
  );

export default UserResourceKeyModel;
