import type { DbKey } from "./db.types";

function readEnv(name: string): string {
  return (process.env[name] ?? "").trim();
}

/**
 * Risolve l'URI per una dbKey.
 *
 * Regola:
 * - prova MONGODB_URI_<DBKEY>
 * - se assente o vuoto => fallback su MONGODB_URI
 *
 * Esempio:
 * - dbKey="anagrafiche" => MONGODB_URI_ANAGRAFICHE
 */
export function resolveMongoUri(dbKey: DbKey): string {
  const specificVar = `MONGODB_URI_${dbKey.toUpperCase()}`;
  const specific = readEnv(specificVar);
  if (specific) return specific;

  const fallback = readEnv("MONGODB_URI");
  if (!fallback) {
    // Meglio fallire in modo chiaro: altrimenti ti ritrovi con errori strani più avanti
    throw new Error(
      `Missing MongoDB URI. Set ${specificVar} or MONGODB_URI in env.`,
    );
  }

  return fallback;
}
