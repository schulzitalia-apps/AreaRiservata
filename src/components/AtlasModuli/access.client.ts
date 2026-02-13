// src/components/AtlasModuli/access.client.ts
"use client";

import type { AppRole } from "@/types/roles";
import {
  ResourcesConfig,
  type CrudAction,
  type ResourceDomain,
} from "@/config/access/access-resources.config";
import { RolesConfig } from "@/config/access/access-roles.config";
import type { AnagraficaTypeSlug } from "@/config/anagrafiche.types.public";
import type { AulaTypeSlug } from "@/config/aule.types.public";
import type { EventoTypeSlug } from "@/config/eventi.types.public";

/** Mappa domain → tipo di slug valido per quel domain */
type ResourceSlugMap = {
  anagrafica: AnagraficaTypeSlug;
  aula: AulaTypeSlug;
  evento: EventoTypeSlug;
};

/**
 * Funzione GENERICA:
 * controlla se UN RUOLO ha il permesso di fare una certa azione
 * su una risorsa di un certo dominio (anagrafica / aula / evento)
 * e di uno specifico slug.
 *
 * Usare SOLO lato client per mostrare/nascondere bottoni.
 */
export function hasRolePermissionForDomain<
  D extends ResourceDomain,
>(
  role: AppRole | undefined,
  domain: D,
  resourceSlug: ResourceSlugMap[D],
  action: CrudAction,
): boolean {
  if (!role) return false;

  // Admin hanno tutto
  const roleCfg = RolesConfig[role];
  if (roleCfg?.isAdmin) return true;

  // prendo il ramo giusto del ResourcesConfig
  const domainCfg = ResourcesConfig[domain] as Record<
    string,
    { actions: Partial<Record<CrudAction, any>> }
  >;

  const cfg = domainCfg[resourceSlug as string];
  if (!cfg) return false;

  const rule = cfg.actions[action];
  if (!rule) return false;

  const inRoles = rule.roles?.includes(role);
  const inOwnOnly = rule.ownOnlyRoles?.includes(role);

  // lato UI non distinguiamo ownOnly: se c'è QUALCHE forma di permesso, mostriamo l’azione
  return !!(inRoles || inOwnOnly);
}

/* -------------------------------------------------------------------------- */
/*  WRAPPER TIPIZZATI (per comodità / DX)                                     */
/* -------------------------------------------------------------------------- */

/** Versione “storica” per ANAGRAFICHE (resta invariata in firma) */
export function hasRolePermission(
  role: AppRole | undefined,
  resourceSlug: AnagraficaTypeSlug,
  action: CrudAction,
): boolean {
  return hasRolePermissionForDomain(role, "anagrafica", resourceSlug, action);
}

/** Wrapper per AULE */
export function hasRolePermissionForAula(
  role: AppRole | undefined,
  aulaSlug: AulaTypeSlug,
  action: CrudAction,
): boolean {
  return hasRolePermissionForDomain(role, "aula", aulaSlug, action);
}

/** Wrapper per EVENTI, se/quando ti serve lato UI */
export function hasRolePermissionForEvento(
  role: AppRole | undefined,
  eventoSlug: EventoTypeSlug,
  action: CrudAction,
): boolean {
  return hasRolePermissionForDomain(role, "evento", eventoSlug, action);
}
