// src/server-utils/anima/commesseSearch.ts
import mongoose from 'mongoose';
import { connectToDatabase } from '@/server-utils/lib/mongoose-connection';
import { getAnagraficaModel } from '@/server-utils/models/Anagrafiche/anagrafiche.factory';
import { getAnagraficaDef } from '@/config/anagrafiche.registry';
import type { FieldKey } from '@/config/anagrafiche.fields.catalog';
import type { AnagraficaTypeSlug } from '@/config/anagrafiche.types.public';

export type CommessaPreview = {
  id: string;
  numeroOrdine: string | null;
  codiceCliente: string | null;
  riferimento: string | null;
  statoAvanzamento: string | null;
  inizioConsegna: string | null;
  fineConsegna: string | null;
  updatedAt: string | null;
};

const SLUG_CONFERME: AnagraficaTypeSlug = 'conferme-ordine' as AnagraficaTypeSlug;

/* ----------------------------- HELPER GENERALE ------------------------------ */

function mapCommessaDoc(d: any, defFields: Record<FieldKey, any>): CommessaPreview {
  const data = d.data || {};

  const get = (k: FieldKey): string | null => {
    const val = data[k];
    if (val === undefined || val === null) return null;
    const s = String(val).trim();
    return s === '' ? null : s;
  };

  const CODICE_CLIENTE: FieldKey = 'codiceCliente' as FieldKey;
  const NUMERO_ORDINE: FieldKey = 'numeroOrdine' as FieldKey;
  const RIF: FieldKey = 'riferimento' as FieldKey;
  const STATO: FieldKey = 'statoAvanzamento' as FieldKey;
  const INIZIO: FieldKey = 'inizioConsegna' as FieldKey;
  const FINE: FieldKey = 'fineConsegna' as FieldKey;

  return {
    id: String(d._id),
    numeroOrdine: defFields[NUMERO_ORDINE] ? get(NUMERO_ORDINE) : null,
    codiceCliente: defFields[CODICE_CLIENTE] ? get(CODICE_CLIENTE) : null,
    riferimento: defFields[RIF] ? get(RIF) : null,
    statoAvanzamento: defFields[STATO] ? get(STATO) : null,
    inizioConsegna: defFields[INIZIO] ? get(INIZIO) : null,
    fineConsegna: defFields[FINE] ? get(FINE) : null,
    updatedAt: d.updatedAt ? new Date(d.updatedAt).toISOString() : null,
  };
}

/* --------------------- COMMESSE COLLEGATE A UN CLIENTE --------------------- */

/**
 * Cerca le conferme d'ordine collegate a un cliente.
 *
 * Assunzione: il campo data.codiceCliente contiene l'ObjectId del cliente.
 * Se nel tuo schema è un codice stringa, basta adattare la query nel filter.
 */
export async function searchCommesseByClienteId(
  clienteId: string,
  limit = 10
): Promise<CommessaPreview[]> {
  await connectToDatabase();

  const def = getAnagraficaDef(SLUG_CONFERME);
  const Model = getAnagraficaModel(SLUG_CONFERME);

  const CODICE_CLIENTE: FieldKey = 'codiceCliente' as FieldKey;

  const filter: any = {};
  if (mongoose.isValidObjectId(clienteId)) {
    filter['data.codiceCliente'] = new mongoose.Types.ObjectId(clienteId);
  } else {
    filter['data.codiceCliente'] = clienteId;
  }

  const projection: Record<string, 1> = { updatedAt: 1 };
  projection['data.codiceCliente'] = 1;
  projection['data.numeroOrdine'] = 1;
  projection['data.riferimento'] = 1;
  projection['data.statoAvanzamento'] = 1;
  projection['data.inizioConsegna'] = 1;
  projection['data.fineConsegna'] = 1;

  const docs = await Model.find(filter, projection)
    .sort({ updatedAt: -1 })
    .limit(limit)
    .lean();

  return docs.map((d: any) => mapCommessaDoc(d, def.fields as any));
}

/* -------------------------- STATO COMMESSA PER TESTO ----------------------- */

/**
 * Cerca commesse per numero ordine, codice cliente o riferimento.
 * Usa una regex case-insensitive sui campi previsti in preview.searchIn.
 */
export async function searchCommesseByTerm(
  term: string,
  limit = 5
): Promise<CommessaPreview[]> {
  await connectToDatabase();

  const def = getAnagraficaDef(SLUG_CONFERME);
  const Model = getAnagraficaModel(SLUG_CONFERME);

  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(escaped, 'i');

  const CODICE_CLIENTE: FieldKey = 'codiceCliente' as FieldKey;
  const NUMERO_ORDINE: FieldKey = 'numeroOrdine' as FieldKey;
  const RIF: FieldKey = 'riferimento' as FieldKey;

  const or: any[] = [];
  if (def.fields[NUMERO_ORDINE]) or.push({ 'data.numeroOrdine': regex });
  if (def.fields[CODICE_CLIENTE]) or.push({ 'data.codiceCliente': regex });
  if (def.fields[RIF]) or.push({ 'data.riferimento': regex });

  const filter = or.length ? { $or: or } : { 'data.numeroOrdine': regex };

  const projection: Record<string, 1> = { updatedAt: 1 };
  projection['data.codiceCliente'] = 1;
  projection['data.numeroOrdine'] = 1;
  projection['data.riferimento'] = 1;
  projection['data.statoAvanzamento'] = 1;
  projection['data.inizioConsegna'] = 1;
  projection['data.fineConsegna'] = 1;

  const docs = await Model.find(filter, projection)
    .sort({ updatedAt: -1 })
    .limit(limit)
    .lean();

  return docs.map((d: any) => mapCommessaDoc(d, def.fields as any));
}
