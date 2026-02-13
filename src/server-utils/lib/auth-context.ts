import type { AppRole } from "@/types/roles";

/**
 * keyScopes:
 *  - primo livello: "kind" di risorsa
 *      es: "anagrafica", "aula", "evento", ...
 *  - secondo livello: slug del tipo
 *      es: "clienti", "conferme-ordine", "cantieri", "agenti", ...
 *  - valore: array di _id (string) a cui l'utente ha accesso
 *
 * Esempio:
 *  {
 *    anagrafica: {
 *      clienti: ["64f...", "650..."],
 *      "conferme-ordine": ["651..."]
 *    },
 *    aula: {
 *      cantieri: ["700..."]
 *    }
 *  }
 */
export type KeyScopes = Partial<
  Record<string, Partial<Record<string, string[]>>>
>;

export interface AuthContext {
  userId: string;
  role: AppRole;
  isAdmin: boolean;
  keyScopes?: KeyScopes;
}
