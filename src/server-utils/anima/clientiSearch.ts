// src/server-utils/anima/clientiSearch.ts
import { connectToDatabase } from '@/server-utils/lib/mongoose-connection';
import { getAnagraficaModel } from '@/server-utils/models/Anagrafiche/anagrafiche.factory';
import { getAnagraficaDef } from '@/config/anagrafiche.registry';
import type { FieldKey } from '@/config/anagrafiche.fields.catalog';
import type { AnagraficaTypeSlug } from '@/config/anagrafiche.types.public';

export type ClientePreview = {
  id: string;

  // identificazione
  nome: string | null;
  cognome: string | null;
  ragioneSociale: string | null;

  // contatti
  email: string | null;
  telefono: string | null;

  // indirizzo
  indirizzo: string | null;
  cap: string | null;
  localita: string | null;

  updatedAt: string | null;
};

/**
 * Cerca nei clienti per nome / ragione sociale usando una regex case-insensitive.
 * Usa la definizione di anagrafica "clienti" per sapere quali campi esistono.
 */
export async function searchClientiByNomeLike(
  term: string,
  limit = 5
): Promise<ClientePreview[]> {
  const slug = 'clienti' as AnagraficaTypeSlug;

  await connectToDatabase();
  const def = getAnagraficaDef(slug);
  const Model = getAnagraficaModel(slug);

  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(escaped, 'i');

  // chiavi tipizzate singolarmente (evita TS7053)
  const NOME: FieldKey = 'nome' as FieldKey;
  const COGNOME: FieldKey = 'cognome' as FieldKey;
  const RAG_SOC: FieldKey = 'ragioneSociale' as FieldKey;
  const EMAIL: FieldKey = 'email' as FieldKey;
  const TELEFONO: FieldKey = 'telefono' as FieldKey;
  const INDIRIZZO: FieldKey = 'indirizzo' as FieldKey;
  const CAP: FieldKey = 'cap' as FieldKey;
  const LOCALITA: FieldKey = 'localita' as FieldKey;

  // condizioni di ricerca: solo se il campo esiste in questo tipo
  const searchOr: any[] = [];
  if (def.fields[NOME]) searchOr.push({ 'data.nome': regex });
  if (def.fields[COGNOME]) searchOr.push({ 'data.cognome': regex });
  if (def.fields[RAG_SOC]) searchOr.push({ 'data.ragioneSociale': regex });

  const queryFilter =
    searchOr.length > 0 ? { $or: searchOr } : { 'data.nome': regex }; // fallback

  // proiezione dinamica ma senza filter su stringa
  const projection: Record<string, 1> = { updatedAt: 1 };
  if (def.fields[NOME]) projection['data.nome'] = 1;
  if (def.fields[COGNOME]) projection['data.cognome'] = 1;
  if (def.fields[RAG_SOC]) projection['data.ragioneSociale'] = 1;
  if (def.fields[EMAIL]) projection['data.email'] = 1;
  if (def.fields[TELEFONO]) projection['data.telefono'] = 1;
  if (def.fields[INDIRIZZO]) projection['data.indirizzo'] = 1;
  if (def.fields[CAP]) projection['data.cap'] = 1;
  if (def.fields[LOCALITA]) projection['data.localita'] = 1;

  const docs = await Model.find(queryFilter, projection)
    .sort({ updatedAt: -1 })
    .limit(limit)
    .lean();

  return docs.map((d: any) => {
    const data = d.data || {};

    const get = (k: FieldKey): string | null => {
      const val = data[k];
      if (val === undefined || val === null) return null;
      const s = String(val).trim();
      return s === '' ? null : s;
    };

    return {
      id: String(d._id),
      nome: def.fields[NOME] ? get(NOME) : null,
      cognome: def.fields[COGNOME] ? get(COGNOME) : null,
      ragioneSociale: def.fields[RAG_SOC] ? get(RAG_SOC) : null,
      email: def.fields[EMAIL] ? get(EMAIL) : null,
      telefono: def.fields[TELEFONO] ? get(TELEFONO) : null,
      indirizzo: def.fields[INDIRIZZO] ? get(INDIRIZZO) : null,
      cap: def.fields[CAP] ? get(CAP) : null,
      localita: def.fields[LOCALITA] ? get(LOCALITA) : null,
      updatedAt: d.updatedAt ? new Date(d.updatedAt).toISOString() : null,
    };
  });
}
