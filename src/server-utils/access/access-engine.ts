// src/server-utils/access/access-engine.ts
import type { Filter } from "mongodb";
import { ObjectId } from "mongodb";
import type { AuthContext } from "@/server-utils/lib/auth-context";

import { RolesConfig } from "@/config/access/access-roles.config";
import {
  ResourcesConfig,
  type CrudAction,
  type ActionRule,
  type ResourceConfig,
  type ResourceDomain,
} from "@/config/access/access-resources.config";

import type { AnagraficaTypeSlug } from "@/config/anagrafiche.types.public";
import { getAnagraficaDef } from "@/config/anagrafiche.registry";
import { isReferenceField } from "@/config/anagrafiche.fields.catalog";

/* -------------------------------------------------------------------------- */
/*  VISIBILITY CONSTANTS                                                      */
/* -------------------------------------------------------------------------- */

export const VISIBILITY_PUBLIC = "Public" as const;
export const VISIBILITY_PUBLIC_READONLY = "PublicReadOnly" as const;

type VisibilityRole =
  | typeof VISIBILITY_PUBLIC
  | typeof VISIBILITY_PUBLIC_READONLY
  | string;

/* -------------------------------------------------------------------------- */
/*  PERMISSION KEY                                                            */
/* -------------------------------------------------------------------------- */

export type PermissionKey = `${ResourceDomain}.${CrudAction}`;

/* -------------------------------------------------------------------------- */
/*  ACTION RULE LOOKUP                                                        */
/* -------------------------------------------------------------------------- */

function getActionRule(
  domain: ResourceDomain,
  action: CrudAction,
  resourceType?: string,
): ActionRule | null {
  const domainCfg = ResourcesConfig[domain] as
    | Record<string, ResourceConfig>
    | undefined;
  if (!domainCfg) return null;

  if (resourceType) {
    const cfg = domainCfg[resourceType];
    const rule = cfg?.actions[action];
    return rule ?? null;
  }

  let merged: ActionRule | null = null;

  for (const cfg of Object.values(domainCfg)) {
    const rule = cfg.actions[action];
    if (!rule) continue;

    if (!merged) {
      merged = {
        roles: rule.roles ? [...rule.roles] : undefined,
        ownOnlyRoles: rule.ownOnlyRoles ? [...rule.ownOnlyRoles] : undefined,
      };
    } else {
      if (rule.roles?.length) {
        merged.roles = Array.from(
          new Set([...(merged.roles ?? []), ...rule.roles]),
        );
      }
      if (rule.ownOnlyRoles?.length) {
        merged.ownOnlyRoles = Array.from(
          new Set([...(merged.ownOnlyRoles ?? []), ...rule.ownOnlyRoles]),
        );
      }
    }
  }

  return merged;
}

/* -------------------------------------------------------------------------- */
/*  HAS PERMISSION                                                            */
/* -------------------------------------------------------------------------- */

export function hasPermission(
  auth: AuthContext,
  permission: PermissionKey,
  options?: { resourceType?: string },
): boolean {
  const roleCfg = RolesConfig[auth.role];
  if (!roleCfg) return false;

  if (roleCfg.isAdmin) return true;

  const [domain, action] = permission.split(".") as [
    ResourceDomain,
    CrudAction,
  ];

  const rule = getActionRule(domain, action, options?.resourceType);
  if (!rule) return false;

  const inRoles = rule.roles?.includes(auth.role);
  const inOwnOnly = rule.ownOnlyRoles?.includes(auth.role);

  return !!(inRoles || inOwnOnly);
}

/* -------------------------------------------------------------------------- */
/*  ACCESS ENGINE: filtro "base" owner / visibility (qualsiasi dominio)        */
/* -------------------------------------------------------------------------- */

export function buildBasicAccessFilter<TSchema = any>(
  auth: AuthContext,
): Filter<TSchema> {
  if (auth.isAdmin) {
    return {} as Filter<TSchema>;
  }

  const orAcl: any[] = [];

  orAcl.push({ owner: auth.userId });

  const visValues: string[] = [VISIBILITY_PUBLIC, VISIBILITY_PUBLIC_READONLY];
  if (auth.role) visValues.push(auth.role);

  // ✅ visibilityRoles è un array: match se contiene uno dei valori (public/readonly/role)
  orAcl.push({ visibilityRoles: { $in: visValues } });

  if (!orAcl.length) return {} as Filter<TSchema>;
  if (orAcl.length === 1) return orAcl[0] as Filter<TSchema>;

  return { $or: orAcl } as Filter<TSchema>;
}

/* -------------------------------------------------------------------------- */
/*  HELPER: slugs anagrafica rilevanti per espansione “sottokey”               */
/* -------------------------------------------------------------------------- */

export function getRelevantAnagraficaSlugsForAuth(auth: AuthContext): string[] {
  const scopes =
    (auth.keyScopes &&
      (auth.keyScopes["anagrafica"] as Record<string, string[]>)) ||
    undefined;

  if (!scopes) return [];

  const direct = new Set(
    Object.entries(scopes)
      .filter(([, ids]) => Array.isArray(ids) && ids.length > 0)
      .map(([slug]) => String(slug)),
  );

  if (!direct.size) return [];

  const out = new Set<string>(direct);

  const domainCfg = ResourcesConfig.anagrafica as Record<string, ResourceConfig>;
  for (const [resourceType, cfg] of Object.entries(domainCfg)) {
    const rules = cfg?.keyFilters ?? [];
    for (const rule of rules) {
      if (rule.enabled === false) continue;
      if (rule.scope?.kind !== "anagrafica") continue;

      const scopeSlug = String(rule.scope.slug);
      if (direct.has(scopeSlug)) {
        out.add(String(resourceType));
        break;
      }
    }
  }

  return Array.from(out);
}

/* -------------------------------------------------------------------------- */
/*  ACCESS ENGINE: filtro Mongo per ANAGRAFICHE (con KEY + sottokey)           */
/* -------------------------------------------------------------------------- */

export function buildMongoAccessFilter<TSchema = any>(
  auth: AuthContext,
  resourceType: AnagraficaTypeSlug,
): Filter<TSchema> {
  const cfg: ResourceConfig | undefined =
    ResourcesConfig.anagrafica[resourceType];

  if (auth.isAdmin || !cfg) {
    return {} as Filter<TSchema>;
  }

  const orAcl: any[] = [];

  // 1) owner
  orAcl.push({ owner: auth.userId });

  // 2) visibilityRoles (array)
  const visValues: string[] = [VISIBILITY_PUBLIC, VISIBILITY_PUBLIC_READONLY];
  if (auth.role) visValues.push(auth.role);

  // ✅ match: array contiene uno dei valori
  orAcl.push({ visibilityRoles: { $in: visValues } });

  const allScopes = auth.keyScopes;

  // scope "anagrafica" (keys su record anagrafici)
  const anagraficaScopes =
    (allScopes && (allScopes["anagrafica"] as Record<string, string[]>)) ||
    undefined;

  // scope "aula" (keys su record aula) — serve per estendere accesso ai membri
  const aulaScopes =
    (allScopes && (allScopes["aula"] as Record<string, string[]>)) || undefined;

  if (cfg.keyFilters) {
    for (const rule of cfg.keyFilters) {
      if (rule.enabled === false) continue;
      if (!rule.roles.includes(auth.role)) continue;

      // ---------------------------------------------------------------------
      // A) Scope su ANAGRAFICA: self / byReference (comportamento invariato)
      // ---------------------------------------------------------------------
      if (rule.scope.kind === "anagrafica") {
        if (!anagraficaScopes) continue;

        const scopeSlug = String(rule.scope.slug);
        const userKeysForScope = anagraficaScopes[scopeSlug] ?? [];
        if (!userKeysForScope.length) continue;

        let fieldPath: string | null = null;

        if (rule.mode === "self") {
          fieldPath = "_id";
        } else if (rule.mode === "byReference" && rule.referenceFieldKey) {
          const def = getAnagraficaDef(resourceType);
          const fieldDef = def.fields[rule.referenceFieldKey];

          if (
            fieldDef &&
            isReferenceField(fieldDef) &&
            fieldDef.reference.kind === "anagrafica" &&
            String(fieldDef.reference.targetSlug) === scopeSlug
          ) {
            fieldPath = `data.${rule.referenceFieldKey}`;
          }
        }

        if (!fieldPath) continue;

        const normalizedKeys = userKeysForScope
          .map((k) => {
            try {
              return new ObjectId(k);
            } catch {
              return null;
            }
          })
          .filter(Boolean);

        if (!normalizedKeys.length) continue;

        orAcl.push({
          [fieldPath]: { $in: normalizedKeys },
        } as any);

        continue;
      }

      // ---------------------------------------------------------------------
      // B) Scope su AULA: byAulaMembership (NUOVO)
      // ---------------------------------------------------------------------
      if (rule.scope.kind === "aula") {
        if (!aulaScopes) continue;
        if (rule.mode !== "byAulaMembership") continue;

        const aulaTypeSlug = String(rule.scope.slug); // es. "agenti", "cantieri"
        const userAulaKeys = aulaScopes[aulaTypeSlug] ?? [];
        if (!userAulaKeys.length) continue;

        const aulaIds = userAulaKeys
          .map((k) => {
            try {
              return new ObjectId(k);
            } catch {
              return null;
            }
          })
          .filter(Boolean);

        if (!aulaIds.length) continue;

        const membership: any = {
          "aule.aulaId": { $in: aulaIds },
        };

        membership["aule.aulaType"] = rule.aulaTypeSlug
          ? String(rule.aulaTypeSlug)
          : aulaTypeSlug;

        orAcl.push(membership);
        continue;
      }
    }
  }

  if (!orAcl.length) return {} as Filter<TSchema>;
  if (orAcl.length === 1) return orAcl[0] as Filter<TSchema>;

  return { $or: orAcl } as Filter<TSchema>;
}

/* -------------------------------------------------------------------------- */
/*  EDIT / DELETE CHECK CON PUBLIC READONLY                                   */
/* -------------------------------------------------------------------------- */

type VisibilityAwareDoc = {
  owner?: any;
  visibilityRoles?: VisibilityRole[] | null;
};

export function canEditOrDeleteResource(
  auth: AuthContext,
  doc: VisibilityAwareDoc,
  domain: ResourceDomain,
  action: Exclude<CrudAction, "view" | "create">,
  options?: { resourceType?: string },
): boolean {
  const roleCfg = RolesConfig[auth.role];
  if (roleCfg?.isAdmin) return true;

  const permKey = `${domain}.${action}` as PermissionKey;
  if (!hasPermission(auth, permKey, options)) {
    return false;
  }

  // ✅ PublicReadOnly se presente nell'array
  const isPublicReadOnly = Array.isArray(doc.visibilityRoles)
    ? doc.visibilityRoles.includes(VISIBILITY_PUBLIC_READONLY)
    : false;

  if (isPublicReadOnly) {
    const isOwner = doc.owner && String(doc.owner) === String(auth.userId);
    return isOwner;
  }

  return true;
}
