import type {
  ActionCondition,
  ConditionValueRef,
  ComparisonOp,
} from "./actions.shared";

/**
 * Helper per costruire ActionCondition in modo più leggibile
 * nelle config (ANAGRAFICHE_ACTIONS, AULE_ACTIONS).
 *
 * Esempi:
 *
 *  condition: cond.and(
 *    cond.cmpNumber(cond.path("anagrafica.totale"), ">=", cond.val(1000)),
 *    cond.inStrings(cond.path("anagrafica.stato"), ["confermato","parzialmente-confermato"]),
 *  )
 */
export const cond = {
  /** Costante: sempre vero */
  always(): ActionCondition {
    return { type: "ALWAYS" };
  },

  /** AND logico fra più condizioni */
  and(...children: ActionCondition[]): ActionCondition {
    return { type: "AND", children };
  },

  /** OR logico fra più condizioni */
  or(...children: ActionCondition[]): ActionCondition {
    return { type: "OR", children };
  },

  /** NOT logico */
  not(child: ActionCondition): ActionCondition {
    return { type: "NOT", child };
  },

  /** Riferimento a path nel contesto (es. "anagrafica.totale") */
  path(path: string): ConditionValueRef {
    return { kind: "path", path };
  },

  /** Valore costante (numero/stringa/boolean/null) */
  val(value: string | number | boolean | null): ConditionValueRef {
    return { kind: "const", value };
  },

  /** Comparazione generica con valueType="number" (>, >=, ==, ecc.) */
  cmpNumber(
    left: ConditionValueRef,
    op: ComparisonOp,
    right: ConditionValueRef,
  ): ActionCondition {
    return {
      type: "CMP",
      valueType: "number",
      left,
      op,
      right,
    };
  },

  /** Comparazione generica con valueType="date" (usa toValidDate) */
  cmpDate(
    left: ConditionValueRef,
    op: ComparisonOp,
    right: ConditionValueRef,
  ): ActionCondition {
    return {
      type: "CMP",
      valueType: "date",
      left,
      op,
      right,
    };
  },

  /** Comparazione generica con valueType="string" */
  cmpString(
    left: ConditionValueRef,
    op: ComparisonOp,
    right: ConditionValueRef,
  ): ActionCondition {
    return {
      type: "CMP",
      valueType: "string",
      left,
      op,
      right,
    };
  },

  /** Uguaglianza stringa semplice: value === expected */
  eqString(
    value: ConditionValueRef,
    expected: string,
  ): ActionCondition {
    return {
      type: "CMP",
      valueType: "string",
      left: value,
      op: "==",
      right: { kind: "const", value: expected },
    };
  },

  /** value IN lista di stringhe */
  inStrings(
    value: ConditionValueRef,
    values: string[],
  ): ActionCondition {
    return {
      type: "IN",
      value,
      values: values.map((v) => ({ kind: "const", value: v })),
    };
  },

  /** Controlla che il valore sia valorizzato (non null/undefined/"") */
  isSet(value: ConditionValueRef): ActionCondition {
    return {
      type: "IS_SET",
      value,
    };
  },

  /** Controlla che il valore NON sia valorizzato */
  isNotSet(value: ConditionValueRef): ActionCondition {
    return {
      type: "IS_NOT_SET",
      value,
    };
  },
};
