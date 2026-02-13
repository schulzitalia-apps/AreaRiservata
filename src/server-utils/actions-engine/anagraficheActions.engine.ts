import type { FieldKey } from "@/config/anagrafiche.fields.catalog";
import { FIELD_CATALOG } from "@/config/anagrafiche.fields.catalog";
import type { AnagraficaTypeSlug } from "@/config/anagrafiche.types.public";
import {
  getAnagraficaActionsForField,
  hasAnagraficaActions,
  type ResolvedAnagraficaAction,
} from "@/config/actions.registry";
import type { TimeKind } from "../models/evento.schema";
import {
  createEvento,
  type EventoPartecipanteView,
} from "../service/eventiQuery";
import { encodeAutoEvent } from "./autoEventCodec";
import {
  toValidDate,
  computeTimeRange,
  renderTemplate,
  startOfDay,
} from "./commonHelpers";
import { evalActionCondition } from "./actionConditions";

// ✅ AGGIUNTA
import { maybeSendEmailsForAutoAction } from "@/server-utils/actions-engine/autoActionsEmailHook";

/* ---------------------- TIPI PARAM PER IL MOTORE ---------------------- */

export type RunAnagraficaAutoActionsOnSaveParams = {
  anagraficaType: AnagraficaTypeSlug;
  anagraficaId: string;
  userId: string;

  /**
   * Stato "dopo" dell'anagrafica (campi dinamici).
   */
  data: Record<string, any>;

  /**
   * Stato "prima" dell'anagrafica.
   * - in POST (create) può essere omesso → viene trattato come tutto undefined.
   */
  previousData?: Record<string, any>;

  /**
   * (Legacy) lista di campi cambiati.
   * - non più necessaria, la logica ora calcola differenze da previousData/data.
   */
  changedFields?: FieldKey[];
};

/* --------------------------- HELPER GENERICI --------------------------- */

function buildEventoDataFromAction(
  action: ResolvedAnagraficaAction,
  ctx: { field: Date; fieldFormatted: string; anagrafica: Record<string, any> },
): Record<string, any> {
  const baseData: Record<string, any> = {
    ...(action.prefillEventoData ?? {}),
  };

  const templateCtx = {
    ...ctx,
    // nei template {{field}} è sempre la data formattata YYYY-MM-DD
    field: ctx.fieldFormatted,
  };

  const title = renderTemplate(action.titleTemplate, templateCtx);
  const descrizione = renderTemplate(action.descriptionTemplate, templateCtx);

  if (title) baseData.titolo = title;
  if (descrizione) baseData.descrizione = descrizione;

  return baseData;
}

function buildPartecipantiForAnagrafica(
  action: ResolvedAnagraficaAction,
  anagraficaType: AnagraficaTypeSlug,
  anagraficaId: string,
): EventoPartecipanteView[] {
  const strategy = (action as any).partecipantiStrategy as
    | "NESSUNO"
    | "SOLO_QUESTA_ANAGRAFICA"
    | string
    | undefined;

  if (strategy === "NESSUNO") return [];

  // default: SOLO_QUESTA_ANAGRAFICA
  return [
    {
      anagraficaType,
      anagraficaId,
      role: null,
      status: null,
      quantity: null,
      note: null,
    },
  ];
}

/* --------------------------- LOGICA TRIGGER --------------------------- */

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
      // solo se il valore è cambiato (e ora ha un valore)
      return changed && hasNext;

    case "ON_FIRST_SET":
      // solo la prima volta che viene messo un valore (prima vuoto → ora valorizzato)
      return firstSet && hasNext;

    default:
      return false;
  }
}

/* ------------------------- MOTORE PRINCIPALE ------------------------- */

export async function runAnagraficaAutoActionsOnSave(
  params: RunAnagraficaAutoActionsOnSaveParams,
): Promise<void> {
  const {
    anagraficaType,
    anagraficaId,
    userId,
    data,
    previousData,
  } = params;

  // 0) se il tipo non ha NESSUNA action configurata → esci subito
  if (!hasAnagraficaActions(anagraficaType)) {
    return;
  }

  const prev = previousData ?? {};
  const next = data ?? {};
  const now = new Date();

  // 1) individua i campi candidati (tutti i campi presenti prima/dopo)
  const fieldSet = new Set<FieldKey>();

  for (const k of Object.keys(prev) as FieldKey[]) {
    if (FIELD_CATALOG[k]) {
      fieldSet.add(k);
    }
  }
  for (const k of Object.keys(next) as FieldKey[]) {
    if (FIELD_CATALOG[k]) {
      fieldSet.add(k);
    }
  }

  if (!fieldSet.size) {
    // nessun campo interessante → non può esserci autoAction
    return;
  }

  const used = new Set<string>();

  for (const field of fieldSet) {
    const prevVal = prev[field];
    const nextVal = next[field];

    const hasPrev = prevVal != null && prevVal !== "";
    const hasNext = nextVal != null && nextVal !== "";

    // se non c'era prima e non c'è ora → campo irrilevante
    if (!hasPrev && !hasNext) continue;

    const prevJson = hasPrev ? JSON.stringify(prevVal) : undefined;
    const nextJson = hasNext ? JSON.stringify(nextVal) : undefined;

    const changed = prevJson !== nextJson;
    const firstSet = !hasPrev && hasNext;

    const actions = getAnagraficaActionsForField(anagraficaType, field);
    if (!actions.length) continue; // per questo campo nessuna action

    for (const action of actions) {
      const trigger = action.trigger as any; // "ON_SAVE" | "ON_CHANGE" | "ON_FIRST_SET"

      if (
        !shouldRunForTrigger(trigger, {
          hasNext,
          changed,
          firstSet,
        })
      ) {
        continue;
      }

      const key = `${action.id}::${field}`;
      if (used.has(key)) continue;
      used.add(key);

      const timeSource = action.timeSource ?? "field";

      // Base date per l'evento (dipende da timeSource)
      let baseDate: Date | null = null;
      let fieldFormatted: string;

      if (timeSource === "field") {
        const dateValue = toValidDate(nextVal);
        if (!dateValue) {
          // timeSource=field richiede un valore data valido
          continue;
        }
        baseDate = dateValue;
        fieldFormatted = dateValue.toISOString().slice(0, 10);
      } else {
        // timeSource = "now" → evento ancorato al giorno corrente
        const today = startOfDay(now);
        baseDate = today;
        fieldFormatted = today.toISOString().slice(0, 10);
      }

      // Valutazione condizione di business (numeri, stati, ecc.)
      const conditionOk = evalActionCondition(action.condition, {
        now,
        fieldKey: field,
        fieldValue: nextVal,
        prevFieldValue: prevVal,
        eventBaseDate: baseDate,
        eventDateFormatted: fieldFormatted,
        field: fieldFormatted,
        anagrafica: next,
        prevAnagrafica: prev,
      });

      if (!conditionOk) continue;

      const { startAt, endAt } = computeTimeRange(
        baseDate!,
        action.timeKind as TimeKind,
        action,
      );

      const eventoData = buildEventoDataFromAction(action, {
        field: baseDate!,
        fieldFormatted,
        anagrafica: next,
      });

      const partecipanti = buildPartecipantiForAnagrafica(
        action,
        anagraficaType,
        anagraficaId,
      );

      await createEvento({
        type: action.eventType,
        userId,
        data: eventoData,
        timeKind: action.timeKind as TimeKind,
        startAt: startAt ? startAt.toISOString() : null,
        endAt: endAt ? endAt.toISOString() : null,
        allDay: !!(action as any).allDayDefault,
        recurrence: null,
        gruppo: null,
        partecipanti,
        visibilityRole: (action as any).defaultVisibilityRole ?? null,
        _autoEvent: encodeAutoEvent("ANAGRAFICA", action.id),
      });

      // ✅ AGGIUNTA: EMAIL HOOK (non deve bloccare il save)
      try {
        await maybeSendEmailsForAutoAction({
          scope: "ANAGRAFICA",
          actionId: action.id,
          anagrafica: {
            anagraficaType,
            anagraficaId,
            data: next,
          },
          // per templateCtx: gli passi lo stesso “contesto” logico che già hai qui
          templateCtx: {
            now,
            field: fieldFormatted,
            fieldKey: field,
            anagrafica: next,
            prevAnagrafica: prev,
            event: {
              type: action.eventType,
              timeKind: action.timeKind,
              startAt: startAt ? startAt.toISOString() : null,
              endAt: endAt ? endAt.toISOString() : null,
            },
          },
        });
      } catch (err) {
        console.error("[AUTO-ACTIONS EMAIL] hook failed:", err);
      }
    }
  }
}
