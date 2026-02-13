// src/components/AtlasModuli/useCrudPermissions.ts
"use client";

import { useMemo } from "react";
import { useAppSelector } from "@/components/Store/hooks";
import type { AppRole } from "@/types/roles";
import type { AnagraficaTypeSlug } from "@/config/anagrafiche.types.public";
import type { AulaTypeSlug } from "@/config/aule.types.public";
import type { EventoTypeSlug } from "@/config/eventi.types.public";

import {
  hasRolePermission,
  hasRolePermissionForAula,
  hasRolePermissionForEvento,
} from "./access.client";

/* --------------------- ANAGRAFICHE --------------------- */

export function useCrudPermissions(slug: AnagraficaTypeSlug) {
  const role = useAppSelector(
    (s) => s.session.user?.role as AppRole | undefined,
  );

  return useMemo(
    () => ({
      canView: hasRolePermission(role, slug, "view"),
      canCreate: hasRolePermission(role, slug, "create"),
      canEdit: hasRolePermission(role, slug, "edit"),
      canDelete: hasRolePermission(role, slug, "delete"),
    }),
    [role, slug],
  );
}

/* ------------------------ AULE ------------------------- */

export function useAulaCrudPermissions(slug: AulaTypeSlug) {
  const role = useAppSelector(
    (s) => s.session.user?.role as AppRole | undefined,
  );

  return useMemo(
    () => ({
      canView: hasRolePermissionForAula(role, slug, "view"),
      canCreate: hasRolePermissionForAula(role, slug, "create"),
      canEdit: hasRolePermissionForAula(role, slug, "edit"),
      canDelete: hasRolePermissionForAula(role, slug, "delete"),
    }),
    [role, slug],
  );
}

/* ----------------------- EVENTI ------------------------ */

export function useEventoCrudPermissions(slug: EventoTypeSlug) {
  const role = useAppSelector(
    (s) => s.session.user?.role as AppRole | undefined,
  );

  return useMemo(
    () => ({
      canView: hasRolePermissionForEvento(role, slug, "view"),
      canCreate: hasRolePermissionForEvento(role, slug, "create"),
      canEdit: hasRolePermissionForEvento(role, slug, "edit"),
      canDelete: hasRolePermissionForEvento(role, slug, "delete"),
    }),
    [role, slug],
  );
}
