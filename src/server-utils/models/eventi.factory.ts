// src/server-utils/models/eventi.factory.ts

import mongoose, { Model } from "mongoose";
import { buildEventoSchema, type IEventoDoc } from "./evento.schema";
import { getEventoDef } from "@/config/eventi.registry";

declare global {
  // eslint-disable-next-line no-var
  var __EVENTO_MODELS__: Map<string, Model<IEventoDoc>> | undefined;
}

// cache globale per evitare di ricreare i model
const cache = (global.__EVENTO_MODELS__ ||= new Map());

async function ensureIndexes(model: Model<IEventoDoc>, type: string) {
  const def = getEventoDef(type);

  const fieldsToIndex = new Set<string>([
    ...def.preview.title,
    ...(def.preview.subtitle || []),
    ...def.preview.searchIn,
  ]);

  try {
    // Indici base
    await model.collection.createIndex({ visibilityRole: 1 });
    await model.collection.createIndex({ updatedAt: -1 });

    // 🔹 Indice per distinguere rapidamente eventi auto / non auto
    //    (_autoEvent valorizzato => evento creato da "Action")
    await model.collection.createIndex({ _autoEvent: 1 });

    // Indici temporali
    await model.collection.createIndex({ timeKind: 1 });
    await model.collection.createIndex({ startAt: 1 });
    await model.collection.createIndex({ endAt: 1 });

    // Indici sui campi in data.{campo} usati in preview/search
    for (const key of fieldsToIndex) {
      await model.collection.createIndex({ [`data.${key}`]: 1 });
    }

    // Indice composto per i campi principali del titolo
    if (def.preview.title.length >= 2) {
      const composed: Record<string, 1> = {};
      def.preview.title.slice(0, 2).forEach((k) => {
        composed[`data.${k}`] = 1;
      });
      await model.collection.createIndex(composed);
    }

    // indice per partecipanti (anagraficaType + anagraficaId)
    await model.collection.createIndex({
      "partecipanti.anagraficaType": 1,
      "partecipanti.anagraficaId": 1,
    });

    // indice per gruppo (aula/gruppo principale)
    await model.collection.createIndex({
      "gruppo.gruppoType": 1,
      "gruppo.gruppoId": 1,
    });

    // indice per ricorrenze (per trovare occorrenze di un master)
    await model.collection.createIndex({
      "recurrence.masterId": 1,
      startAt: 1,
    });
  } catch (e) {
    // non bloccare la request se non puoi creare indici
    // console.error("[Evento ensureIndexes]", e);
  }
}

export function getEventoModel(type: string): Model<IEventoDoc> {
  const { collection } = getEventoDef(type);

  // se esiste già in cache, lo riuso
  if (cache.has(collection)) return cache.get(collection)!;

  const MODEL_NAME = `Evento_v1__${collection}`;
  const schema = buildEventoSchema();

  const model =
    (mongoose.models[MODEL_NAME] as Model<IEventoDoc>) ||
    mongoose.model<IEventoDoc>(MODEL_NAME, schema, collection);

  cache.set(collection, model);

  // lancia in background la creazione indici (non blocca la request)
  void ensureIndexes(model, type);

  return model;
}
