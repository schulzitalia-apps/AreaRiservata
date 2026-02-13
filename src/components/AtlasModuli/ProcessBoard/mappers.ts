import type { EventoDef } from "@/config/eventi.registry";
import type { EventoPreview, EventoFull } from "@/components/Store/models/eventi";
import type { WhiteboardEventVM, WhiteboardParticipant } from "./types";

/* ----------------------------- EVENT NORMALIZER ----------------------------- */

/**
 * Ritorna l'intervallo "intero giorno" del timestamp passato,
 * ma ANCORATO AL GIORNO LOCALE (es. Italia), non UTC.
 *
 * start = 00:00:00 (locale) del giorno dell'evento
 * end   = 23:59:59 (locale) dello stesso giorno
 *
 * Poi convertiamo entrambi in ISO (UTC) con toISOString().
 */
function dayBoundsLocal(iso: string) {
  const d = new Date(iso); // interpretato e manipolato in timezone locale

  const y = d.getFullYear();
  const m = d.getMonth();
  const day = d.getDate();

  const startLocal = new Date(y, m, day, 0, 0, 0);
  const endLocal = new Date(y, m, day, 23, 59, 59);

  return { start: startLocal.toISOString(), end: endLocal.toISOString() };
}

export function normalizeEventoPreviewToWhiteboardVM(
  p: EventoPreview,
  def: EventoDef,
): WhiteboardEventVM | null {
  // ✅ supporto eventi "puntuali":
  // - se arriva solo startAt -> end = startAt
  // - se arriva solo endAt   -> start = endAt
  let start = (p.startAt ?? p.endAt ?? null) as string | null;
  let end = (p.endAt ?? p.startAt ?? null) as string | null;

  if (!start || !end) return null;

  // ✅ evento puntuale (start === end) => copre l'intero giorno LOCALE del timestamp
  // (non "24 ore a partire da", e non sfora al giorno dopo in UI)
  if (start === end) {
    const b = dayBoundsLocal(start);
    start = b.start;
    end = b.end;
  }

  return {
    id: p.id,
    title: p.displayName,
    subtitle: p.subtitle ?? null,

    start,
    end,

    typeSlug: def.slug,
    typeLabel: def.label,

    visibilityRole: p.visibilityRole ?? null,

    participants: [], // riempito con enrichment su EventoFull
  };
}

/* ---------------------------- PARTICIPANT EXTRACTOR -------------------------- */

function normStr(x: any): string {
  return String(x ?? "").trim();
}

function bestName(x: any): string {
  const dn =
    (typeof x?.displayName === "string" && x.displayName.trim()) ||
    (typeof x?.label === "string" && x.label.trim()) ||
    "";
  return dn || "(senza nome)";
}

/**
 * Estrae i partecipanti da EventoFull.
 * - Fonte "ricca" (con displayName): ev.data.partecipantiCollegati[]
 * - Fonte "strutturata" (solo type/id): ev.partecipanti[]
 *
 * NB: qui NON facciamo fetch per risolvere nomi mancanti: quello lo fa l’hook useParticipantNameCache.
 */
export function extractParticipantsFromEventoFull(
  ev: EventoFull,
): WhiteboardParticipant[] {
  const out = new Map<string, WhiteboardParticipant>();
  const data: any = ev.data || {};

  // 1) Fonte ricca: data.partecipantiCollegati
  const linked = Array.isArray(data.partecipantiCollegati)
    ? data.partecipantiCollegati
    : [];
  for (const x of linked) {
    const t = normStr(x?.type ?? x?.anagraficaType);
    const id = normStr(x?.anagraficaId ?? x?.id);
    if (!t || !id) continue;

    const key = `${t}:${id}`;

    if (!out.has(key)) {
      out.set(key, {
        key,
        anagraficaType: t,
        anagraficaId: id,
        displayName: bestName(x),
        subtitle:
          typeof x?.subtitle === "string" && x.subtitle.trim()
            ? x.subtitle.trim()
            : null,
      });
    }
  }

  // 2) Fonte strutturata: ev.partecipanti (solo type/id)
  const strutt = Array.isArray(ev.partecipanti) ? ev.partecipanti : [];
  for (const p of strutt) {
    const t = normStr((p as any)?.anagraficaType);
    const id = normStr((p as any)?.anagraficaId);
    if (!t || !id) continue;

    const key = `${t}:${id}`;
    if (out.has(key)) continue;

    out.set(key, {
      key,
      anagraficaType: t,
      anagraficaId: id,
      displayName: "(senza nome)", // verrà risolto dal cache hook se possibile
      subtitle: null,
    });
  }

  return [...out.values()].sort((a, b) =>
    a.displayName.localeCompare(b.displayName),
  );
}
