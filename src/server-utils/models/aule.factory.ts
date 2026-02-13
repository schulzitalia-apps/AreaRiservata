// src/server-utils/models/aule.factory.ts

import mongoose, { Model } from "mongoose";
import { buildAulaSchema, IAulaDoc } from "./aula.schema";
import { getAulaDef, type AulaDef } from "@/config/aule.registry";

declare global {
  // eslint-disable-next-line no-var
  var __AULA_MODELS__: Map<string, Model<IAulaDoc>> | undefined;
}

const cache = (global.__AULA_MODELS__ ||= new Map());

async function ensureIndexes(model: Model<IAulaDoc>, type: string) {
  const def: AulaDef = getAulaDef(type);

  // Campi usati in preview o ricerca
  const fieldsToIndex = new Set<string>([
    ...def.preview.title,
    ...(def.preview.subtitle || []),
    ...def.preview.searchIn,
  ]);

  try {
    /** ---------------------------------------------
     *  INDICI BASE
     * ---------------------------------------------- */
    await model.collection.createIndex({ tipoSlug: 1 });
    await model.collection.createIndex({ updatedAt: -1 });

    /** ---------------------------------------------
     *  NOVITÀ: indicizzare la visibility
     * ---------------------------------------------- */
    await model.collection.createIndex({ visibilityRole: 1 });

    /** ---------------------------------------------
     *  NOVITÀ: indicizzare gli attachments
     * ---------------------------------------------- */
    await model.collection.createIndex({ "attachments.documentId": 1 });
    await model.collection.createIndex({ "attachments.type": 1 });

    /** ---------------------------------------------
     *  Dati custom dell'aula (preview/search)
     * ---------------------------------------------- */
    for (const key of fieldsToIndex) {
      await model.collection.createIndex({ [`dati.${key}`]: 1 });
    }

    // Indice combinato title[0]+title[1] se esistono almeno due campi
    if (def.preview.title.length >= 2) {
      const composed: Record<string, 1> = {};
      def.preview.title.slice(0, 2).forEach((k) => {
        composed[`dati.${k}`] = 1;
      });
      await model.collection.createIndex(composed);
    }
  } catch (err) {
    // non bloccare nulla in produzione
  }
}

export function getAulaModel(type: string): Model<IAulaDoc> {
  const def = getAulaDef(type);
  const { collection } = def;

  if (cache.has(collection)) return cache.get(collection)!;

  const MODEL_NAME = `Aula_v1__${collection}`;
  const schema = buildAulaSchema();

  const model =
    (mongoose.models[MODEL_NAME] as Model<IAulaDoc>) ||
    mongoose.model<IAulaDoc>(MODEL_NAME, schema, collection);

  cache.set(collection, model);

  // crea indici in background
  void ensureIndexes(model, type);

  return model;
}
