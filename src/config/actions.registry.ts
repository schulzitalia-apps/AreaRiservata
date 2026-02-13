import {
  ANAGRAFICHE_ACTIONS,
  type PublicAnagraficaActionDef,
} from "./actions.anagrafiche.public";
import {
  AULE_ACTIONS,
  type PublicAulaActionDef,
} from "./actions.aule.public";

import {
  FIELD_CATALOG,
  type FieldKey,
} from "./anagrafiche.fields.catalog";
import {
  AULA_FIELD_CATALOG,
  type AulaFieldKey,
  AULA_PARTECIPANTE_FIELD_CATALOG,
  type AulaPartecipanteFieldKey,
} from "./aule.fields.catalog";

import {
  ANAGRAFICA_TYPES,
  type AnagraficaTypeSlug,
} from "./anagrafiche.types.public";
import {
  AULE_TYPES,
  type AulaTypeSlug,
} from "./aule.types.public";

import {
  EVENTO_TYPES,
  type EventoTypeSlug,
} from "./eventi.types.public";

import type {
  ActionScope,
  ActionUiTone,
  ActionTimeSource,
} from "./actions.shared";

/** Un'azione può essere su ANAGRAFICA o su AULA */
export type AnyPublicActionDef =
  | PublicAnagraficaActionDef
  | PublicAulaActionDef;

export type ResolvedAnagraficaAction = PublicAnagraficaActionDef & {
  scope: "ANAGRAFICA";
  /** Sempre valorizzato dopo la build (default: "field") */
  timeSource: ActionTimeSource;
};

export type ResolvedAulaAction = PublicAulaActionDef & {
  scope: "AULA";
  /** Sempre valorizzato dopo la build (default: "field") */
  timeSource: ActionTimeSource;
};

export type AnyResolvedAction =
  | ResolvedAnagraficaAction
  | ResolvedAulaAction;

/* ------------------------------------------------------------------ */
/*                         MAPPE DI SUPPORTO                          */
/* ------------------------------------------------------------------ */

const eventoTypeMap = new Map<EventoTypeSlug, (typeof EVENTO_TYPES)[number]>(
  EVENTO_TYPES.map((t) => [t.slug as EventoTypeSlug, t]),
);

const anagraficaTypeSet = new Set<AnagraficaTypeSlug>(
  ANAGRAFICA_TYPES.map((t) => t.slug as AnagraficaTypeSlug),
);

const aulaTypeSet = new Set<AulaTypeSlug>(
  AULE_TYPES.map((t) => t.slug as AulaTypeSlug),
);

/**
 * Mappa per recuperare rapidamente le azioni da eseguire
 * al salvataggio:
 *
 * - per le anagrafiche:   [anagraficaType][field]
 * - per le aule:          [aulaType][field]
 */
const ANAGRAFICHE_ACTIONS_BY_TYPE_AND_FIELD: Record<
  AnagraficaTypeSlug,
  Partial<Record<FieldKey, ResolvedAnagraficaAction[]>>
> = {} as any;

/**
 * Per le AULE ora il field può essere:
 * - un campo dell'aula (AulaFieldKey)
 * - un campo del partecipante (AulaPartecipanteFieldKey)
 *
 * Usiamo string come chiave per semplificare.
 */
type AulaAnyFieldKey = AulaFieldKey | AulaPartecipanteFieldKey;

const AULE_ACTIONS_BY_TYPE_AND_FIELD: Record<
  AulaTypeSlug,
  Partial<Record<string, ResolvedAulaAction[]>>
> = {} as any;

/**
 * Mappe per recuperare un'azione a partire da (scope, id).
 * Usate soprattutto dal motore di visibilità sugli auto-eventi.
 */
const ANAGRAFICHE_ACTIONS_BY_ID = new Map<string, ResolvedAnagraficaAction>();
const AULE_ACTIONS_BY_ID = new Map<string, ResolvedAulaAction>();

/**
 * Set di tipi che hanno almeno UNA action configurata.
 * Usato per fare short-circuit nei motori (se false → return subito).
 */
const ANAGRAFICHE_TYPES_WITH_ACTIONS = new Set<AnagraficaTypeSlug>();
const AULE_TYPES_WITH_ACTIONS = new Set<AulaTypeSlug>();

/**
 * Set dei tipi evento che compaiono almeno in UNA action
 * (serve al pannello UI per sapere quali “categorie di azione”
 * esistono complessivamente: es. urgenze, avvisi, ecc.)
 */
const EVENT_TYPES_WITH_ACTIONS = new Set<EventoTypeSlug>();

/**
 * Mappa opzionale: per ogni tipo di evento un "tone" UI suggerito
 * (warning, danger, info, ecc.), letto dal campo opzionale uiTone
 * delle singole azioni.
 */
const EVENT_TYPE_TONE = new Map<EventoTypeSlug, ActionUiTone>();

/* ------------------------------------------------------------------ */
/*                 COSTRUZIONE REGISTRY UNICO ALL'IMPORT              */
/* ------------------------------------------------------------------ */

function buildRegistry() {
  /* -------------------------- ANAGRAFICHE -------------------------- */

  for (const action of ANAGRAFICHE_ACTIONS) {
    if (action.scope !== "ANAGRAFICA") continue;

    if (!anagraficaTypeSet.has(action.anagraficaType)) {
      throw new Error(
        `[AUTO-EVENTS] anagraficaType non valido: ${action.anagraficaType} (azione: ${action.id})`,
      );
    }

    const fieldDef = FIELD_CATALOG[action.field];
    if (!fieldDef) {
      throw new Error(
        `[AUTO-EVENTS] field non valido: ${action.field} (azione: ${action.id})`,
      );
    }

    const timeSource: ActionTimeSource =
      (action as any).timeSource ?? "field";

    if (timeSource === "field" && fieldDef.type !== "date") {
      throw new Error(
        `[AUTO-EVENTS] field=${action.field} deve essere di tipo date quando timeSource="field" (azione: ${action.id})`,
      );
    }

    const eventoTypeSlug = action.eventType as EventoTypeSlug;
    const eventoTypeDef = eventoTypeMap.get(eventoTypeSlug);
    if (!eventoTypeDef) {
      throw new Error(
        `[AUTO-EVENTS] eventType non valido: ${action.eventType} (azione: ${action.id})`,
      );
    }

    if (
      eventoTypeDef.allowedTimeKinds &&
      !eventoTypeDef.allowedTimeKinds.includes(action.timeKind)
    ) {
      throw new Error(
        `[AUTO-EVENTS] timeKind=${action.timeKind} non consentito per eventType=${action.eventType} (azione: ${action.id})`,
      );
    }

    const resolved: ResolvedAnagraficaAction = {
      ...action,
      scope: "ANAGRAFICA",
      timeSource,
    };

    const typeSlug = resolved.anagraficaType as AnagraficaTypeSlug;

    // segno che questo tipo ha almeno una action
    ANAGRAFICHE_TYPES_WITH_ACTIONS.add(typeSlug);

    // mappa per id
    if (ANAGRAFICHE_ACTIONS_BY_ID.has(resolved.id)) {
      throw new Error(
        `[AUTO-EVENTS] id azione duplicato (ANAGRAFICA): ${resolved.id}`,
      );
    }
    ANAGRAFICHE_ACTIONS_BY_ID.set(resolved.id, resolved);

    // mappa per [tipo][field]
    ANAGRAFICHE_ACTIONS_BY_TYPE_AND_FIELD[typeSlug] ||= {};
    ANAGRAFICHE_ACTIONS_BY_TYPE_AND_FIELD[typeSlug]![resolved.field] ||= [];
    ANAGRAFICHE_ACTIONS_BY_TYPE_AND_FIELD[typeSlug]![resolved.field]!.push(
      resolved,
    );

    // tracking del tipo evento usato in almeno una Action
    EVENT_TYPES_WITH_ACTIONS.add(eventoTypeSlug);

    // eventuale tone UI (primo che capita per quel tipo evento)
    const uiTone = (action as any).uiTone as ActionUiTone | undefined;
    if (uiTone && !EVENT_TYPE_TONE.has(eventoTypeSlug)) {
      EVENT_TYPE_TONE.set(eventoTypeSlug, uiTone);
    }
  }

  /* ---------------------------- AULE ------------------------------- */

  for (const action of AULE_ACTIONS) {
    if (action.scope !== "AULA") continue;

    if (!aulaTypeSet.has(action.aulaType)) {
      throw new Error(
        `[AUTO-EVENTS] aulaType non valido: ${action.aulaType} (azione: ${action.id})`,
      );
    }

    /**
     * field può essere:
     * - un campo dell'aula (AulaFieldKey → AULA_FIELD_CATALOG)
     * - un campo del partecipante (AulaPartecipanteFieldKey → AULA_PARTECIPANTE_FIELD_CATALOG)
     */
    const aulaFieldDef =
      AULA_FIELD_CATALOG[action.field as AulaFieldKey];
    const partecipanteFieldDef =
      AULA_PARTECIPANTE_FIELD_CATALOG[
        action.field as AulaPartecipanteFieldKey
        ];

    const fieldDef = aulaFieldDef ?? partecipanteFieldDef;

    if (!fieldDef) {
      throw new Error(
        `[AUTO-EVENTS] field non valido: ${action.field} (azione: ${action.id})`,
      );
    }

    const timeSource: ActionTimeSource =
      (action as any).timeSource ?? "field";

    if (timeSource === "field" && fieldDef.type !== "date") {
      throw new Error(
        `[AUTO-EVENTS] field=${action.field} deve essere di tipo date quando timeSource="field" (azione: ${action.id})`,
      );
    }

    const eventoTypeSlug = action.eventType as EventoTypeSlug;
    const eventoTypeDef = eventoTypeMap.get(eventoTypeSlug);
    if (!eventoTypeDef) {
      throw new Error(
        `[AUTO-EVENTS] eventType non valido: ${action.eventType} (azione: ${action.id})`,
      );
    }

    if (
      eventoTypeDef.allowedTimeKinds &&
      !eventoTypeDef.allowedTimeKinds.includes(action.timeKind)
    ) {
      throw new Error(
        `[AUTO-EVENTS] timeKind=${action.timeKind} non consentito per eventType=${action.eventType} (azione: ${action.id})`,
      );
    }

    const resolved: ResolvedAulaAction = {
      ...action,
      scope: "AULA",
      timeSource,
    };

    const typeSlug = resolved.aulaType as AulaTypeSlug;

    // segno che questo tipo ha almeno una action
    AULE_TYPES_WITH_ACTIONS.add(typeSlug);

    // mappa per id
    if (AULE_ACTIONS_BY_ID.has(resolved.id)) {
      throw new Error(
        `[AUTO-EVENTS] id azione duplicato (AULA): ${resolved.id}`,
      );
    }
    AULE_ACTIONS_BY_ID.set(resolved.id, resolved);

    // mappa per [tipo][field] usando string come chiave
    AULE_ACTIONS_BY_TYPE_AND_FIELD[typeSlug] ||= {};
    const byField = AULE_ACTIONS_BY_TYPE_AND_FIELD[typeSlug]!;
    const fieldKey = resolved.field as string;

    byField[fieldKey] ||= [];
    byField[fieldKey]!.push(resolved);

    // tracking del tipo evento usato in almeno una Action
    EVENT_TYPES_WITH_ACTIONS.add(eventoTypeSlug);

    // eventuale tone UI (primo che capita per quel tipo evento)
    const uiTone = (action as any).uiTone as ActionUiTone | undefined;
    if (uiTone && !EVENT_TYPE_TONE.has(eventoTypeSlug)) {
      EVENT_TYPE_TONE.set(eventoTypeSlug, uiTone);
    }
  }
}

// esegui una volta all'import
buildRegistry();

/* ------------------------------------------------------------------ */
/*                         API USATE DAI MOTORI                       */
/* ------------------------------------------------------------------ */

/**
 * Ritorna tutte le azioni di tipo "ANAGRAFICA" che
 * si applicano a (anagraficaType, field).
 *
 * Usato dal motore che scatta al salvataggio dell'anagrafica.
 */
export function getAnagraficaActionsForField(
  anagraficaType: AnagraficaTypeSlug,
  field: FieldKey,
): ResolvedAnagraficaAction[] {
  return ANAGRAFICHE_ACTIONS_BY_TYPE_AND_FIELD[anagraficaType]?.[field] ?? [];
}

/**
 * Ritorna tutte le azioni di tipo "AULA" che
 * si applicano a (aulaType, field).
 *
 * field può essere sia AulaFieldKey che AulaPartecipanteFieldKey.
 *
 * Usato dal motore che scatta al salvataggio dell'aula.
 */
export function getAulaActionsForField(
  aulaType: AulaTypeSlug,
  field: AulaAnyFieldKey,
): ResolvedAulaAction[] {
  return AULE_ACTIONS_BY_TYPE_AND_FIELD[aulaType]?.[field as string] ?? [];
}

/**
 * Ritorna una singola azione a partire da (scope, id).
 *
 * Usato dal motore di visibilità sugli eventi automatici,
 * che parte dal campo _autoEvent dell'evento:
 *  - decode(_autoEvent) -> { scope, actionId }
 *  - resolveActionById(scope, actionId)
 */
export function resolveActionById(
  scope: ActionScope,
  id: string,
): AnyResolvedAction | null {
  if (scope === "ANAGRAFICA") {
    return ANAGRAFICHE_ACTIONS_BY_ID.get(id) ?? null;
  }
  if (scope === "AULA") {
    return AULE_ACTIONS_BY_ID.get(id) ?? null;
  }
  return null;
}

/**
 * Ritorna true se il tipo di anagrafica ha almeno
 * una action configurata (qualsiasi campo).
 *
 * Usato dai motori per fare short-circuit.
 */
export function hasAnagraficaActions(
  anagraficaType: AnagraficaTypeSlug,
): boolean {
  return ANAGRAFICHE_TYPES_WITH_ACTIONS.has(anagraficaType);
}

/**
 * Ritorna true se il tipo di aula ha almeno
 * una action configurata (qualsiasi campo).
 */
export function hasAulaActions(aulaType: AulaTypeSlug): boolean {
  return AULE_TYPES_WITH_ACTIONS.has(aulaType);
}

/* ------------------------------------------------------------------ */
/*            API PER LA UI: TIPI EVENTO + CONFIGURAZIONE VISIVA      */
/* ------------------------------------------------------------------ */

/** Elenco di tutti i tipo evento (slug) che compaiono in almeno una Action. */
export function getEventTypesWithActions(): EventoTypeSlug[] {
  return Array.from(EVENT_TYPES_WITH_ACTIONS);
}

/**
 * Config UI per le “categorie di azione” (tipo evento).
 * - eventType: slug del tipo evento (es. "urgenze", "avvisi")
 * - label: etichetta leggibile (da EVENTO_TYPES)
 * - tone: tone UI suggerito (warning, danger, ecc.), se definito in almeno
 *         una Action che usa questo tipo evento.
 */
export type EventoActionUiConfig = {
  eventType: EventoTypeSlug;
  label: string;
  tone?: ActionUiTone;
};

export function getEventoActionUiConfig(): EventoActionUiConfig[] {
  return Array.from(EVENT_TYPES_WITH_ACTIONS)
    .map((slug) => {
      const def = eventoTypeMap.get(slug);
      return {
        eventType: slug,
        label: def?.label ?? slug,
        tone: EVENT_TYPE_TONE.get(slug),
      };
    })
    .sort((a, b) => a.label.localeCompare(b.label));
}

