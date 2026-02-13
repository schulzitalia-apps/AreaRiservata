// src/server-utils/service/Anagrafiche/list/utils/parse-fields.ts
import type { FieldKey } from "@/config/anagrafiche.fields.catalog";

/**
 * Parser leggero per fields da querystring:
 * - accetta "a,b,c" oppure ["a,b", "c"] oppure ["a", "b"]
 * - ritorna FieldKey[] (cast) lasciando la whitelist al builder (def.fields)
 */
export function parseFieldsInput(
  input?: string | string[] | null,
): FieldKey[] | undefined {
  if (!input) return undefined;

  const parts = Array.isArray(input) ? input : [input];

  const tokens = parts
    .flatMap((s) => String(s).split(","))
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  return tokens as FieldKey[];
}
