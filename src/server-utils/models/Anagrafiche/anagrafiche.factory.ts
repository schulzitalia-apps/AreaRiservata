// src/server-utils/models/Anagrafiche/anagrafiche.factory.ts
import mongoose, { Model } from "mongoose";

import {
  buildAnagraficaSchema,
  type IAnagraficaDoc,
} from "./anagrafica.schema";

import { getAnagraficaDef } from "@/config/anagrafiche.registry";

/**
 * EVOLVE ATLAS — Model registry dinamico per Anagrafiche
 * -----------------------------------------------------
 * Ogni "tipo anagrafica" (definito da configurazione Atlas) può puntare a una collection diversa.
 * Questo file espone una factory `getAnagraficaModel(type)` che:
 * - crea/riusa un Model Mongoose per la collection del tipo
 * - applica lo schema base comune (buildAnagraficaSchema)
 * - garantisce la creazione degli indici (una volta per processo, per collection)
 *
 * Perché cache globale?
 * - In dev (hot reload) e/o in alcuni runtime, i moduli possono essere ricaricati più volte.
 * - Mongoose mantiene un registry di `mongoose.models`, ma avere una cache nostra per collection
 *   rende più esplicito e sicuro il riuso.
 *
 * Perché guardia indici?
 * - `createIndex` è idempotente, ma chiamarlo ad ogni request crea roundtrip inutili.
 * - con una guardia, lo facciamo una sola volta per processo e per collection.
 */

declare global {
  // eslint-disable-next-line no-var
  var __ANAGRAFICA_MODELS__: Map<string, Model<IAnagraficaDoc>> | undefined;

  // eslint-disable-next-line no-var
  var __ANAGRAFICA_INDEXES_ENSURED__: Set<string> | undefined;
}

/**
 * Cache globale:
 * - key: collection
 * - value: Model<IAnagraficaDoc>
 */
const modelsCache = (global.__ANAGRAFICA_MODELS__ ||= new Map());

/**
 * Guardia globale per indici:
 * - contiene le collection per cui abbiamo già lanciato ensureIndexes in questo processo
 */
const indexesEnsured = (global.__ANAGRAFICA_INDEXES_ENSURED__ ||= new Set());

/**
 * Crea gli indici necessari per la collection del tipo.
 * NOTA: viene chiamata in fire-and-forget e protetta dalla guardia `indexesEnsured`.
 */
async function ensureIndexes(model: Model<IAnagraficaDoc>, type: string) {
  const def = getAnagraficaDef(type);

  /**
   * Campi usati in preview / ricerca:
   * indicizziamo `data.<campo>` per rendere veloci list e filtri.
   *
   * - title: campi principali mostrati come titolo
   * - subtitle: campi secondari (opzionali)
   * - searchIn: campi su cui la UI/servizio ricerca tipicamente filtra o matcha
   */
  const fieldsToIndex = new Set<string>([
    ...def.preview.title,
    ...(def.preview.subtitle || []),
    ...def.preview.searchIn,
  ]);

  try {
    /**
     * Indici base:
     * - visibilityRoles: tipicamente usato per filtri ACL/visibilità
     *   NOTA: essendo un array, Mongo crea un multikey index.
     */
    await model.collection.createIndex({ visibilityRoles: 1 });

    /**
     * Indici dinamici su campi custom:
     * `data` è Mixed, ma possiamo indicizzare path specifici `data.<key>`.
     */
    for (const key of fieldsToIndex) {
      await model.collection.createIndex({ [`data.${key}`]: 1 });
    }

    /**
     * Indice composto: primi 2 campi del titolo (se presenti).
     * Utile quando il titolo è (es.) nome+cognome o codice+descrizione.
     */
    if (def.preview.title.length >= 2) {
      const composed: Record<string, 1> = {};
      def.preview.title.slice(0, 2).forEach((k) => {
        composed[`data.${k}`] = 1;
      });
      await model.collection.createIndex(composed);
    }

    /**
     * Indici per il collegamento alle Aule (array -> multikey index).
     * Aiutano molto quando:
     * - cerchi tutte le anagrafiche di una certa aula
     * - filtri per tipo aula
     * - filtri combinati tipo + id
     */
    await model.collection.createIndex({ "aule.aulaId": 1 });
    await model.collection.createIndex({ "aule.aulaType": 1 });
    await model.collection.createIndex({ "aule.aulaType": 1, "aule.aulaId": 1 });
  } catch (e) {
    /**
     * Non blocchiamo la request se mancano permessi o in ambienti con policy restrittive.
     * Se serve, loggare con livello debug/warn.
     */
    // console.error("[Anagrafiche ensureIndexes]", e);
  }
}

/**
 * Restituisce il Model Mongoose per un tipo anagrafica.
 *
 * - `type` identifica un "tipo Atlas" (definizione config-driven)
 * - la definizione include la `collection` dove sono salvati i documenti di quel tipo
 *
 * Comportamento:
 * 1) riusa un model già creato (cache per collection)
 * 2) altrimenti crea:
 *    - schema base comune (buildAnagraficaSchema)
 *    - model Mongoose forzando la collection (3° argomento)
 * 3) garantisce indici (fire-and-forget) UNA VOLTA per processo/collection
 */
export function getAnagraficaModel(type: string): Model<IAnagraficaDoc> {
  const { collection } = getAnagraficaDef(type);

  // 1) Riusa il model dalla cache se già presente
  const cached = modelsCache.get(collection);
  if (cached) return cached;

  // 2) Crea (o riusa da mongoose.models) un model associato a quella collection
  const MODEL_NAME = `Anagrafica_v2__${collection}`;
  const schema = buildAnagraficaSchema();

  const model =
    (mongoose.models[MODEL_NAME] as Model<IAnagraficaDoc>) ||
    mongoose.model<IAnagraficaDoc>(MODEL_NAME, schema, collection);

  // salva in cache
  modelsCache.set(collection, model);

  // 3) Assicura gli indici UNA SOLA VOLTA per processo/collection
  if (!indexesEnsured.has(collection)) {
    indexesEnsured.add(collection);
    void ensureIndexes(model, type);
  }

  return model;
}
