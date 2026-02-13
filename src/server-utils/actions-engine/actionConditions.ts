import type {
  ActionCondition,
  ConditionValueRef,
  ConditionValueType,
  ComparisonOp,
} from "@/config/actions.shared";
import { toValidDate } from "./commonHelpers";

/**
 * Contesto disponibile dentro alle ActionCondition.
 *
 * I path usabili nei ConditionValueRef (kind:"path") sono presi da qui.
 *
 * Esempi di path:
 *  - "anagrafica.totale"
 *  - "anagrafica.stato"
 *  - "aula.stato"
 *  - "partecipante.dati.esito"
 *  - "fieldValue" / "prevFieldValue"
 *  - "eventBaseDate" / "eventDateFormatted"
 *  - "now"
 */
export type ActionConditionContext = {
  /** Data/ora corrente (momento del salvataggio) */
  now: Date;

  /** Nome del campo che ha scatenato l'azione */
  fieldKey?: string;

  /** Valore "dopo" del campo */
  fieldValue?: any;

  /** Valore "prima" del campo */
  prevFieldValue?: any;

  /** Data base usata per calcolare startAt/endAt (field o now) */
  eventBaseDate?: Date;

  /** Data base formattata YYYY-MM-DD */
  eventDateFormatted?: string;

  /**
   * Alias usato nei template come {{field}}.
   * Di solito coincide con eventDateFormatted.
   */
  field?: any;

  // mondo anagrafiche
  anagrafica?: Record<string, any>;
  prevAnagrafica?: Record<string, any>;

  // mondo aula
  aula?: Record<string, any>;
  prevAula?: Record<string, any>;

  // mondo partecipante aula
  partecipante?: {
    anagraficaId: string;
    dati: Record<string, any>;
    prevDati?: Record<string, any>;
  };
};

function getByPath(obj: any, path: string): any {
  const segments = path.split(".");
  let current = obj;
  for (const seg of segments) {
    if (current == null) return undefined;
    current = current[seg];
  }
  return current;
}

function resolveValue(
  ref: ConditionValueRef,
  ctx: ActionConditionContext,
): any {
  if (ref.kind === "const") return ref.value;
  if (ref.kind === "path") return getByPath(ctx, ref.path);
  return undefined;
}

function normalize(
  raw: any,
  valueType: ConditionValueType,
): any {
  if (valueType === "number") {
    if (raw == null) return null;
    const n = typeof raw === "number" ? raw : Number(raw);
    return Number.isNaN(n) ? null : n;
  }

  if (valueType === "string") {
    return raw == null ? null : String(raw);
  }

  if (valueType === "date") {
    const d = toValidDate(raw);
    return d ? d.getTime() : null;
  }

  // auto
  if (raw instanceof Date) return raw.getTime();
  if (typeof raw === "number") return raw;

  const asNumber = Number(raw);
  if (!Number.isNaN(asNumber)) return asNumber;

  return raw == null ? null : String(raw);
}

function compare(left: any, right: any, op: ComparisonOp): boolean {
  if (left == null || right == null) return false;

  // confronto numerico se entrambi numeri
  if (typeof left === "number" && typeof right === "number") {
    switch (op) {
      case "==": return left === right;
      case "!=": return left !== right;
      case ">":  return left > right;
      case ">=": return left >= right;
      case "<":  return left < right;
      case "<=": return left <= right;
    }
  }

  // altrimenti confronto string
  const l = String(left);
  const r = String(right);

  switch (op) {
    case "==": return l === r;
    case "!=": return l !== r;
    case ">":  return l > r;
    case ">=": return l >= r;
    case "<":  return l < r;
    case "<=": return l <= r;
  }
}

/**
 * Valuta una ActionCondition sul contesto passato.
 *
 * - Se cond è undefined → true (nessuna condizione = sempre vero).
 * - Gestisce AND/OR/NOT, comparazioni, IN, IS_SET / IS_NOT_SET.
 */
export function evalActionCondition(
  cond: ActionCondition | undefined,
  ctx: ActionConditionContext,
): boolean {
  if (!cond) return true;

  switch (cond.type) {
    case "ALWAYS":
      return true;

    case "AND":
      return cond.children.every((c) => evalActionCondition(c, ctx));

    case "OR":
      return cond.children.some((c) => evalActionCondition(c, ctx));

    case "NOT":
      return !evalActionCondition(cond.child, ctx);

    case "IS_SET": {
      const v = resolveValue(cond.value, ctx);
      return v !== undefined && v !== null && v !== "";
    }

    case "IS_NOT_SET": {
      const v = resolveValue(cond.value, ctx);
      return v === undefined || v === null || v === "";
    }

    case "IN": {
      const v = resolveValue(cond.value, ctx);
      const candidates = cond.values.map((r) => resolveValue(r, ctx));
      return candidates.some((c) => c === v);
    }

    case "CMP": {
      const vt = cond.valueType ?? "auto";
      const leftRaw = resolveValue(cond.left, ctx);
      const rightRaw = resolveValue(cond.right, ctx);
      const left = normalize(leftRaw, vt);
      const right = normalize(rightRaw, vt);
      return compare(left, right, cond.op);
    }
  }
}
