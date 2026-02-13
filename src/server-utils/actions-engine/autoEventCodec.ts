import type { ActionScope } from "@/config/actions.shared";

/**
 * Scope ammessi per le Auto-Actions:
 * - "ANAGRAFICA"
 * - "AULA"
 *
 * (riuso ActionScope per coerenza con il mondo config)
 */
export type AutoEventScope = ActionScope;

export type AutoEventMeta = {
  scope: AutoEventScope;
  actionId: string;
};

/**
 * Mappa per trasformare lo scope in un prefisso 1-char,
 * così _autoEvent rimane super compatto.
 */
const SCOPE_PREFIX: Record<AutoEventScope, string> = {
  ANAGRAFICA: "N", // N = "Nome"/"Persona", giusto per ricordarlo
  AULA: "A",
};

const PREFIX_SCOPE: Record<string, AutoEventScope> = {
  N: "ANAGRAFICA",
  A: "AULA",
};

/**
 * Codifica una meta info di auto-evento in una stringa.
 *
 * Esempio:
 *  encodeAutoEvent("ANAGRAFICA","atleti__scadenza_cert") => "N|atleti__scadenza_cert"
 */
export function encodeAutoEvent(
  scope: AutoEventScope,
  actionId: string,
): string {
  const prefix = SCOPE_PREFIX[scope] ?? "N";
  return `${prefix}|${actionId}`;
}

/**
 * Decodifica il campo _autoEvent.
 *
 * Se la stringa è vuota/malata → ritorna null (motore può ignorare).
 */
export function decodeAutoEvent(raw?: string | null): AutoEventMeta | null {
  if (!raw || typeof raw !== "string") return null;

  const [prefix, actionId] = raw.split("|");
  if (!actionId) return null;

  const scope = PREFIX_SCOPE[prefix];
  if (!scope) return null;

  return { scope, actionId };
}
