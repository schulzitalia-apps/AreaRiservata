/**
 * COME L'EVENTO "APPARE" NEL TEMPO IN BASE ALLA DATA DI RIFERIMENTO.
 *
 * - DOPO_DATA:     lo mostri solo da quando la data è passata
 * - FINO_A_DATA:   lo mostri solo prima della data
 * - FINESTRA:      lo mostri in un intervallo relativo (es. da -30 gg a 0)
 * - SEMPRE:        sempre visibile, la data è solo informativa
 */
export type ActionVisibilityKind =
  | "DOPO_DATA"
  | "FINO_A_DATA"
  | "FINESTRA"
  | "SEMPRE";

/**
 * QUANDO SCATTA L'AZIONE AL SALVATAGGIO.
 *
 * - ON_SAVE:       ogni volta che salvi (se il campo ha un valore)
 * - ON_CHANGE:     solo se il valore è cambiato rispetto a prima
 * - ON_FIRST_SET:  solo la prima volta che viene valorizzato
 */
export type ActionTriggerKind =
  | "ON_SAVE"
  | "ON_CHANGE"
  | "ON_FIRST_SET";

/**
 * SU CHI STA LAVORANDO L'AZIONE.
 *
 * - ANAGRAFICA:    persona/cliente/ordine ecc. (mondo anagrafiche)
 * - AULA:          gruppo/corso (mondo aule)
 */
export type ActionScope = "ANAGRAFICA" | "AULA";

/**
 * TONI POSSIBILI PER I BOX / BADGE DI AVVISO IN UI.
 * Allineato ai "tone" della InfoPill.
 */
export type ActionUiTone =
  | "neutral"
  | "primary"
  | "secondary"
  | "success"
  | "warning"
  | "danger"
  | "info"
  | "sky"
  | "violet"
  | "rose";

/**
 * DA DOVE PRENDERE LA DATA DI RIFERIMENTO PER L'EVENTO.
 *
 * - "field": usa il valore del campo indicato da `field` (tipicamente una data).
 * - "now":   usa la data/ora attuale (giorno in cui si triggera l'azione).
 */
export type ActionTimeSource = "field" | "now";

/* ------------------------------------------------------------------ */
/*                          SISTEMA CONDIZIONI                        */
/* ------------------------------------------------------------------ */

/**
 * RIFERIMENTO A UN VALORE USATO NELLE CONDIZIONI.
 *
 * - kind: "const" → valore costante (numero, stringa, boolean, null)
 * - kind: "path"  → path nel contesto (es. "anagrafica.totale",
 *                   "aula.stato", "partecipante.dati.esito", ecc.)
 */
export type ConditionValueRef =
  | { kind: "const"; value: string | number | boolean | null }
  | { kind: "path"; path: string };

/**
 * Operatori di confronto base.
 */
export type ComparisonOp = "==" | "!=" | ">" | ">=" | "<" | "<=";

/**
 * Come tipizzare il valore nelle comparazioni.
 *
 * - "auto":   tenta di capire da solo (Date → ms, number → number, ecc.)
 * - "number": forza a number
 * - "string": forza a string
 * - "date":   interpreta come data
 */
export type ConditionValueType = "auto" | "number" | "string" | "date";

/**
 * AST delle condizioni per le Auto Actions.
 *
 * ESEMPI:
 *
 * 1) totale >= 1000
 *    { type: "CMP", valueType: "number", op: ">=",
 *      left: { kind: "path", path: "anagrafica.totale" },
 *      right:{ kind: "const", value: 1000 } }
 *
 * 2) stato IN ["confermato","parzialmente-confermato"]
 *    { type: "IN",
 *      value: { kind: "path", path: "anagrafica.stato" },
 *      values: [
 *        { kind: "const", value: "confermato" },
 *        { kind: "const", value: "parzialmente-confermato" },
 *      ] }
 *
 * 3) (condA AND condB) OR condC
 *    { type:"OR", children:[ {type:"AND",children:[condA,condB]}, condC ] }
 */
export type ActionCondition =
  | { type: "ALWAYS" }
  | { type: "AND"; children: ActionCondition[] }
  | { type: "OR"; children: ActionCondition[] }
  | { type: "NOT"; child: ActionCondition }
  | {
  type: "CMP";
  valueType?: ConditionValueType;
  left: ConditionValueRef;
  op: ComparisonOp;
  right: ConditionValueRef;
}
  | {
  type: "IN";
  value: ConditionValueRef;
  values: ConditionValueRef[];
}
  | {
  type: "IS_SET" | "IS_NOT_SET";
  value: ConditionValueRef;
};
