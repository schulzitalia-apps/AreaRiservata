import type {
  AulaFieldKey,
  AulaPartecipanteFieldKey,
} from "@/config/aule.fields.catalog";
import {
  AULA_FIELD_CATALOG,
  AULA_PARTECIPANTE_FIELD_CATALOG,
} from "@/config/aule.fields.catalog";
import type { AulaTypeSlug } from "@/config/aule.types.public";
import {
  getAulaActionsForField,
  hasAulaActions,
  type ResolvedAulaAction,
} from "@/config/actions.registry";
import type { TimeKind } from "../models/evento.schema";
import {
  createEvento,
  type EventoPartecipanteView,
  type EventoGruppoView,
} from "../service/eventiQuery";
import { encodeAutoEvent } from "./autoEventCodec";
import {
  toValidDate,
  computeTimeRange,
  renderTemplate,
  startOfDay,
} from "./commonHelpers";

import type { AulaPartecipanteDetail } from "../service/auleQuery";
import { evalActionCondition } from "./actionConditions";

// ✅ AGGIUNTA
import { maybeSendEmailsForAutoAction } from "@/server-utils/actions-engine/autoActionsEmailHook";

/* -------------------------------------------------------------------------- */
/*                                  TIPI                                      */
/* -------------------------------------------------------------------------- */

export type AulaPartecipanteLite = {
  anagraficaType: string;
  anagraficaId: string;
  role?: string | null;
  status?: string | null;
  quantity?: number | null;
  note?: string | null;
};

export type RunAulaAutoActionsOnSaveParams = {
  aulaType: AulaTypeSlug;
  aulaId: string;
  userId: string;

  /**
   * Stato "dopo" del documento AULA (dati configurabili).
   */
  data: Record<string, any>;

  /**
   * Stato "prima" del documento AULA (dati configurabili).
   * - in POST di creazione può essere omesso (treated as tutto undefined).
   */
  previousData?: Record<string, any>;

  /**
   * Partecipanti in forma "lite" per agganciarli agli eventi.
   */
  partecipanti?: AulaPartecipanteLite[];

  /**
   * Partecipanti "dopo" con dati completi (inclusi i campi dinamici .dati).
   */
  partecipantiDettaglio?: AulaPartecipanteDetail[];

  /**
   * Partecipanti "prima" con dati completi (per capire cambi, first-set, ecc.).
   * - in POST di creazione può essere omesso.
   */
  previousPartecipantiDettaglio?: AulaPartecipanteDetail[];
};

type EventoBuildContext = {
  field: Date;
  fieldFormatted: string;
  aula: Record<string, any>;
  origin: "AULA" | "PARTECIPANTE";
  partecipante?: {
    anagraficaId: string;
    dati: Record<string, any>;
  };
};

/* -------------------------------------------------------------------------- */
/*                        HELPER PARTECIPANTI / GRUPPO                        */
/* -------------------------------------------------------------------------- */

function buildPartecipantiForAula(
  action: ResolvedAulaAction,
  aulaPartecipantiLite: AulaPartecipanteLite[] | undefined,
): EventoPartecipanteView[] {
  const strategy = (action as any).partecipantiStrategy as
    | "NESSUNO"
    | "TUTTI_PARTECIPANTI_AULA"
    | string
    | undefined;

  if (strategy === "NESSUNO") return [];

  if (strategy === "TUTTI_PARTECIPANTI_AULA") {
    if (!aulaPartecipantiLite?.length) return [];
    return aulaPartecipantiLite.map((p) => ({
      anagraficaType: p.anagraficaType,
      anagraficaId: p.anagraficaId,
      role: p.role ?? null,
      status: p.status ?? null,
      quantity: typeof p.quantity === "number" ? p.quantity : null,
      note: p.note ?? null,
    }));
  }

  return [];
}

function buildGruppoForAula(
  action: ResolvedAulaAction,
  aulaType: AulaTypeSlug,
  aulaId: string,
): EventoGruppoView | null {
  const strategy = (action as any).gruppoStrategy as
    | "NESSUN_GRUPPO"
    | "AULA_COME_GRUPPO"
    | string
    | undefined;

  if (!strategy || strategy === "NESSUN_GRUPPO") return null;

  if (strategy === "AULA_COME_GRUPPO") {
    return {
      gruppoType: aulaType,
      gruppoId: aulaId,
    };
  }

  return null;
}

function buildEventoDataFromAulaAction(
  action: ResolvedAulaAction,
  ctx: EventoBuildContext,
): Record<string, any> {
  const baseData: Record<string, any> = {
    ...(action.prefillEventoData ?? {}),
  };

  const templateCtx = {
    ...ctx,
    // nei template {{field}} è sempre la data formattata YYYY-MM-DD
    field: ctx.fieldFormatted,
  };

  const baseTitle = renderTemplate(action.titleTemplate, templateCtx);
  const descrizione = renderTemplate(action.descriptionTemplate, templateCtx);

  let finalTitle = baseTitle;

  // Prefisso richiesto per eventi generati da campi PARTECIPANTE
  if (ctx.origin === "PARTECIPANTE" && baseTitle) {
    finalTitle = `RIF: PARTECIPANTE per AULA ${baseTitle}`;
  }

  if (finalTitle) baseData.titolo = finalTitle;
  if (descrizione) baseData.descrizione = descrizione;

  return baseData;
}

/* -------------------------------------------------------------------------- */
/*                         LOGICA TRIGGER PER UN CAMPO                        */
/* -------------------------------------------------------------------------- */

function shouldRunForTrigger(
  trigger: "ON_SAVE" | "ON_CHANGE" | "ON_FIRST_SET",
  opts: { hasNext: boolean; changed: boolean; firstSet: boolean },
): boolean {
  const { hasNext, changed, firstSet } = opts;

  switch (trigger) {
    case "ON_SAVE":
      // ogni volta che salvi, se il campo ha un valore
      return hasNext;

    case "ON_CHANGE":
      // solo se il valore è cambiato E ora ha un valore
      return changed && hasNext;

    case "ON_FIRST_SET":
      // solo la prima volta che viene messo un valore (prima vuoto → ora valorizzato)
      return firstSet && hasNext;

    default:
      return false;
  }
}

/* -------------------------------------------------------------------------- */
/*                            MOTORE PRINCIPALE                               */
/* -------------------------------------------------------------------------- */

export async function runAulaAutoActionsOnSave(
  params: RunAulaAutoActionsOnSaveParams,
): Promise<void> {
  const {
    aulaType,
    aulaId,
    userId,
    data,
    previousData,
    partecipanti: aulaPartecipantiLite,
    partecipantiDettaglio,
    previousPartecipantiDettaglio,
  } = params;

  // 0) se il tipo di aula non ha actions → esci subito
  if (!hasAulaActions(aulaType)) {
    return;
  }

  const now = new Date();
  const used = new Set<string>();

  /* ---------------------------------------------------------------------- */
  /*                         AZIONI SU CAMPI AULA                           */
  /* ---------------------------------------------------------------------- */

  const prevAula = previousData ?? {};
  const nextAula = data ?? {};

  // unione di tutte le chiavi potenziali, filtrate su campi definiti in catalog
  const aulaFieldSet = new Set<AulaFieldKey>();

  for (const key of Object.keys(prevAula) as AulaFieldKey[]) {
    if (AULA_FIELD_CATALOG[key]) {
      aulaFieldSet.add(key);
    }
  }
  for (const key of Object.keys(nextAula) as AulaFieldKey[]) {
    if (AULA_FIELD_CATALOG[key]) {
      aulaFieldSet.add(key);
    }
  }

  for (const field of aulaFieldSet) {
    const prevVal = prevAula[field];
    const nextVal = nextAula[field];

    const hasPrev = prevVal != null && prevVal !== "";
    const hasNext = nextVal != null && nextVal !== "";

    // se non c'era prima e non c'è ora → campo irrilevante
    if (!hasPrev && !hasNext) continue;

    const prevJson = hasPrev ? JSON.stringify(prevVal) : undefined;
    const nextJson = hasNext ? JSON.stringify(nextVal) : undefined;

    const changed = prevJson !== nextJson;
    const firstSet = !hasPrev && hasNext;

    const actions = getAulaActionsForField(aulaType, field);
    if (!actions.length) continue;

    for (const action of actions) {
      if (
        !shouldRunForTrigger(action.trigger as any, {
          hasNext,
          changed,
          firstSet,
        })
      ) {
        continue;
      }

      const key = `${action.id}::AULA::${field}`;
      if (used.has(key)) continue;
      used.add(key);

      const timeSource = action.timeSource ?? "field";

      // Base date per l'evento
      let baseDate: Date | null = null;
      let fieldFormatted: string;

      if (timeSource === "field") {
        const dateValue = toValidDate(nextVal);
        if (!dateValue) continue; // richiede data valida
        baseDate = dateValue;
        fieldFormatted = dateValue.toISOString().slice(0, 10);
      } else {
        const today = startOfDay(now);
        baseDate = today;
        fieldFormatted = today.toISOString().slice(0, 10);
      }

      const conditionOk = evalActionCondition(action.condition, {
        now,
        fieldKey: field,
        fieldValue: nextVal,
        prevFieldValue: prevVal,
        eventBaseDate: baseDate,
        eventDateFormatted: fieldFormatted,
        field: fieldFormatted,
        aula: nextAula,
        prevAula,
      });

      if (!conditionOk) continue;

      const { startAt, endAt } = computeTimeRange(
        baseDate!,
        action.timeKind as TimeKind,
        action as any,
      );

      const eventoData = buildEventoDataFromAulaAction(action, {
        field: baseDate!,
        fieldFormatted,
        aula: nextAula,
        origin: "AULA",
      });

      const eventoPartecipanti = buildPartecipantiForAula(
        action,
        aulaPartecipantiLite,
      );

      const gruppo = buildGruppoForAula(action, aulaType, aulaId);

      await createEvento({
        type: action.eventType,
        userId,
        data: eventoData,
        timeKind: action.timeKind as TimeKind,
        startAt: startAt ? startAt.toISOString() : null,
        endAt: endAt ? endAt.toISOString() : null,
        allDay: !!(action as any).allDayDefault,
        recurrence: null,
        gruppo: gruppo
          ? {
            gruppoType: gruppo.gruppoType,
            gruppoId: gruppo.gruppoId,
          }
          : null,
        partecipanti: eventoPartecipanti,
        visibilityRole: (action as any).defaultVisibilityRole ?? null,
        _autoEvent: encodeAutoEvent("AULA", action.id),
      });

      // ✅ AGGIUNTA: EMAIL HOOK (non deve bloccare il save)
      try {
        await maybeSendEmailsForAutoAction({
          scope: "AULA",
          actionId: action.id,
          aula: {
            aulaType: String(aulaType),
            aulaId: String(aulaId),
            data: nextAula,
            partecipanti: aulaPartecipantiLite,
          },
          templateCtx: {
            now,
            field: fieldFormatted,
            fieldKey: field,
            aula: nextAula,
            prevAula,
            event: {
              type: action.eventType,
              timeKind: action.timeKind,
              startAt: startAt ? startAt.toISOString() : null,
              endAt: endAt ? endAt.toISOString() : null,
              gruppo: gruppo
                ? { gruppoType: gruppo.gruppoType, gruppoId: gruppo.gruppoId }
                : null,
            },
          },
        });
      } catch (err) {
        console.error("[AUTO-ACTIONS EMAIL] hook failed:", err);
      }
    }
  }

  /* ---------------------------------------------------------------------- */
  /*                     AZIONI SU CAMPI PARTECIPANTE                       */
  /* ---------------------------------------------------------------------- */

  if (!partecipantiDettaglio?.length) {
    return;
  }

  const prevPartecipantiMap = new Map<string, AulaPartecipanteDetail>();
  for (const p of previousPartecipantiDettaglio ?? []) {
    prevPartecipantiMap.set(p.anagraficaId, p);
  }

  for (const partecipante of partecipantiDettaglio) {
    const prev = prevPartecipantiMap.get(partecipante.anagraficaId);
    const prevDati = prev?.dati ?? {};
    const nextDati = partecipante.dati ?? {};

    const keySet = new Set<AulaPartecipanteFieldKey>();
    for (const k of Object.keys(prevDati) as AulaPartecipanteFieldKey[]) {
      if (AULA_PARTECIPANTE_FIELD_CATALOG[k]) {
        keySet.add(k);
      }
    }
    for (const k of Object.keys(nextDati) as AulaPartecipanteFieldKey[]) {
      if (AULA_PARTECIPANTE_FIELD_CATALOG[k]) {
        keySet.add(k);
      }
    }

    if (!keySet.size) continue;

    for (const pField of keySet) {
      const prevVal = prevDati[pField];
      const nextVal = nextDati[pField];

      const hasPrev = prevVal != null && prevVal !== "";
      const hasNext = nextVal != null && nextVal !== "";

      if (!hasPrev && !hasNext) continue;

      const prevJson = hasPrev ? JSON.stringify(prevVal) : undefined;
      const nextJson = hasNext ? JSON.stringify(nextVal) : undefined;

      const changed = prevJson !== nextJson;
      const firstSet = !hasPrev && hasNext;

      const actions = getAulaActionsForField(
        aulaType,
        pField as unknown as AulaFieldKey,
      );
      if (!actions.length) continue;

      for (const action of actions) {
        if (
          !shouldRunForTrigger(action.trigger as any, {
            hasNext,
            changed,
            firstSet,
          })
        ) {
          continue;
        }

        const key = `${action.id}::PARTECIPANTE::${pField}::${partecipante.anagraficaId}`;
        if (used.has(key)) continue;
        used.add(key);

        const timeSource = action.timeSource ?? "field";

        let baseDate: Date | null = null;
        let fieldFormatted: string;

        if (timeSource === "field") {
          const dateValue = toValidDate(nextVal);
          if (!dateValue) continue;
          baseDate = dateValue;
          fieldFormatted = dateValue.toISOString().slice(0, 10);
        } else {
          const today = startOfDay(now);
          baseDate = today;
          fieldFormatted = today.toISOString().slice(0, 10);
        }

        const conditionOk = evalActionCondition(action.condition, {
          now,
          fieldKey: pField,
          fieldValue: nextVal,
          prevFieldValue: prevVal,
          eventBaseDate: baseDate,
          eventDateFormatted: fieldFormatted,
          field: fieldFormatted,
          aula: nextAula,
          prevAula,
          partecipante: {
            anagraficaId: partecipante.anagraficaId,
            dati: nextDati,
            prevDati,
          },
        });

        if (!conditionOk) continue;

        const { startAt, endAt } = computeTimeRange(
          baseDate!,
          action.timeKind as TimeKind,
          action as any,
        );

        const eventoData = buildEventoDataFromAulaAction(action, {
          field: baseDate!,
          fieldFormatted,
          aula: nextAula,
          origin: "PARTECIPANTE",
          partecipante: {
            anagraficaId: partecipante.anagraficaId,
            dati: nextDati,
          },
        });

        const eventoPartecipanti = buildPartecipantiForAula(
          action,
          aulaPartecipantiLite,
        );

        const gruppo = buildGruppoForAula(action, aulaType, aulaId);

        await createEvento({
          type: action.eventType,
          userId,
          data: eventoData,
          timeKind: action.timeKind as TimeKind,
          startAt: startAt ? startAt.toISOString() : null,
          endAt: endAt ? endAt.toISOString() : null,
          allDay: !!(action as any).allDayDefault,
          recurrence: null,
          gruppo: gruppo
            ? {
              gruppoType: gruppo.gruppoType,
              gruppoId: gruppo.gruppoId,
            }
            : null,
          partecipanti: eventoPartecipanti,
          visibilityRole: (action as any).defaultVisibilityRole ?? null,
          _autoEvent: encodeAutoEvent("AULA", action.id),
        });

        // ✅ AGGIUNTA: EMAIL HOOK (evento generato da PARTECIPANTE)
        try {
          await maybeSendEmailsForAutoAction({
            scope: "AULA",
            actionId: action.id,
            aula: {
              aulaType: String(aulaType),
              aulaId: String(aulaId),
              data: nextAula,
              partecipanti: aulaPartecipantiLite,
            },
            templateCtx: {
              now,
              field: fieldFormatted,
              fieldKey: pField,
              aula: nextAula,
              prevAula,
              partecipante: {
                anagraficaId: partecipante.anagraficaId,
                dati: nextDati,
                prevDati,
              },
              event: {
                type: action.eventType,
                timeKind: action.timeKind,
                startAt: startAt ? startAt.toISOString() : null,
                endAt: endAt ? endAt.toISOString() : null,
                gruppo: gruppo
                  ? { gruppoType: gruppo.gruppoType, gruppoId: gruppo.gruppoId }
                  : null,
              },
            },
          });
        } catch (err) {
          console.error("[AUTO-ACTIONS EMAIL] hook failed:", err);
        }
      }
    }
  }
}
