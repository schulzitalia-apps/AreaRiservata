// src/components/AtlasModuli/Aule/AulaViewer.tsx
"use client";

import { useEffect, useMemo, useCallback } from "react";
import { useAppDispatch, useAppSelector } from "@/components/Store/hooks";
import { fetchAulaById } from "@/components/Store/slices/auleSlice";
import type { AulaDetail } from "@/components/Store/models/aule";

import { fetchAnagrafiche } from "@/components/Store/slices/anagraficheSlice";
import type { AnagraficaPreview } from "@/components/Store/models/anagrafiche";

import { getAulaDef } from "@/config/aule.registry";
import { getAnagraficaDef } from "@/config/anagrafiche.registry";

import {
  AULA_PARTECIPANTE_FIELD_CATALOG,
  type AulaPartecipanteFieldKey,
} from "@/config/aule.fields.catalog";

import { InfoPill } from "@/components/AtlasModuli/common/InfoPill";
import {
  DetailInfoCard,
  type DetailField,
} from "@/components/AtlasModuli/common/DetailInfoCard";

import {
  AttachmentsPanel,
  type AttachmentViewItem,
} from "@/components/AtlasModuli/common/AttachmentsPanel";

import { AulaPartecipantiPanel } from "./AulaPartecipantiPanel";

// 🔐 permessi
import type { AppRole } from "@/types/roles";
import { RolesConfig } from "@/config/access/access-roles.config";
import {
  ResourcesConfig,
  type ActionRule,
} from "@/config/access/access-resources.config";

// 🔔 icone
import { Icons } from "@/components/AtlasModuli/common/icons";

type Props = {
  type: string;
  id: string;
};

type Attachment = NonNullable<AulaDetail["attachments"]>[number];

export default function AulaViewer({ type, id }: Props) {
  const aulaDef = getAulaDef(type);
  const anagDef = getAnagraficaDef(aulaDef.anagraficaSlug);

  const partecipanteFields: AulaPartecipanteFieldKey[] = Object.keys(
    AULA_PARTECIPANTE_FIELD_CATALOG,
  ) as AulaPartecipanteFieldKey[];

  const dispatch = useAppDispatch();

  const current = useAppSelector((s) => s.aule.current) as AulaDetail | null;
  const currentStatus = useAppSelector((s) => s.aule.currentStatus);

  const anagBucket = useAppSelector(
    (s) => s.anagrafiche.byType[aulaDef.anagraficaSlug],
  );
  const anagItems: AnagraficaPreview[] = anagBucket?.items ?? [];

  const sessionUser = useAppSelector((s) => s.session.user);
  const role = sessionUser?.role as AppRole | undefined;
  const userId = sessionUser?.id as string | undefined;

  /* --------------------------------- LOAD ---------------------------------- */

  useEffect(() => {
    if (id) dispatch(fetchAulaById({ type, id }));
  }, [dispatch, type, id]);

  useEffect(() => {
    if (!current) return;
    dispatch(fetchAnagrafiche({ type: aulaDef.anagraficaSlug }));
  }, [dispatch, aulaDef.anagraficaSlug, current]);

  const isLoading =
    currentStatus === "loading" || !current || current.id !== id;

  /* ------------------------------ CAMPI AULA ------------------------------- */

  const fieldKeys = useMemo(
    () => Object.keys(aulaDef.fields) as Array<keyof typeof aulaDef.fields>,
    [aulaDef.fields],
  );

  const titolo = current?.campi?.titolo || current?.label || aulaDef.label;
  const visibilityLabel = current?.visibilityRole || "Solo proprietario";

  const infoFields: DetailField[] = useMemo(
    () =>
      fieldKeys.map((key) => {
        const fld: any = aulaDef.fields[key];
        let val = current?.campi?.[key];
        if (fld.type === "date" && val) {
          val = new Date(val).toLocaleDateString();
        }
        if (!val && val !== 0) val = "—";
        return {
          id: String(key),
          label: fld.label,
          value: String(val),
        };
      }),
    [fieldKeys, aulaDef.fields, current],
  );

  /* --------------------------- ATTACHMENTS VIEWMODEL ---------------------- */

  const attachmentItems: AttachmentViewItem[] = useMemo(() => {
    const attachments: Attachment[] = current?.attachments ?? [];
    return attachments.map((a) => ({
      id: a._id,
      title: a.document?.title || `doc ${a.documentId}`,
      href: `/api/documents/${a.documentId}/view`,
      category: a.document?.category || "altro",
      type: a.type,
      uploadedAt: a.uploadedAt ?? null,
    }));
  }, [current]);

  /* ---------------------------- IMMAGINI BOX ------------------------------ */

  const coverSrc = aulaDef.detailCard.coverSrc;
  const avatarSrc = aulaDef.detailCard.avatarSrc;
  const headerVariant = aulaDef.detailCard.headerVariant;
  const avatarSize = aulaDef.detailCard.avatarSize;
  const hoverEffect = aulaDef.detailCard.hoverEffect;

  /* ----------------------------- PERMESSO EDIT ----------------------------- */

  const canEdit = useMemo(() => {
    if (!role) return false;

    const roleCfg = RolesConfig[role];
    if (roleCfg?.isAdmin) return true;

    const aulaCfgMap = ResourcesConfig.aula as Record<
      string,
      { actions?: Record<string, ActionRule> }
    >;

    const cfg = aulaCfgMap[type];
    const rule = cfg?.actions?.edit;
    if (!rule) return false;

    const baseCanEdit =
      !!(rule.roles?.includes(role) || rule.ownOnlyRoles?.includes(role));
    if (!baseCanEdit) return false;

    const ownerId = (current as any)?.owner ?? (current as any)?.ownerId ?? null;
    const isOwner = ownerId && userId && String(ownerId) === String(userId);

    if (current?.visibilityRole === "PublicReadOnly" && !isOwner) {
      return false;
    }
    return true;
  }, [role, type, current, userId]);

  /* ------------------------- POPUP CALENDARIO AULA ------------------------ */

  const handleOpenCalendarPopup = useCallback(() => {
    if (!id) return;

    const partecipanteType = aulaDef.anagraficaSlug; // es. "agenti"

    const url =
      `/calendar/aula-popup` +
      `?gruppoType=${encodeURIComponent(type)}` + // es. "cantieri"
      `&gruppoId=${encodeURIComponent(id)}` + // id aula
      `&label=${encodeURIComponent(titolo)}` + // nome aula
      `&partecipanteType=${encodeURIComponent(partecipanteType)}`;

    window.open(
      url,
      "aula-calendar",
      "width=500,height=700,noopener,noreferrer",
    );
  }, [type, id, titolo, aulaDef.anagraficaSlug]);

  /* ------------------------------------------------------------------------ */

  return (
    <div className="space-y-6">
      {/* DATI AULA */}
      <DetailInfoCard
        title={titolo}
        loading={isLoading}
        backHref={`/aule/${type}`}
        editHref={`/aule/${type}/${id}/edit`}
        canEdit={canEdit}
        pills={
          <>
            <InfoPill tone="success">Tipo aula: {aulaDef.label}</InfoPill>
            <InfoPill tone="rose">Visibilità: {visibilityLabel}</InfoPill>
            {current?.numeroPartecipanti !== undefined && (
              <InfoPill tone="violet">
                Partecipanti: {current.numeroPartecipanti}
              </InfoPill>
            )}
          </>
        }
        fields={infoFields}
        coverSrc={coverSrc}
        avatarSrc={avatarSrc}
        headerVariant={headerVariant}
        avatarSize={avatarSize}
        hoverEffect={hoverEffect}
        headerActions={
          !isLoading && (
            <button
              type="button"
              onClick={handleOpenCalendarPopup}
              className="
                inline-flex items-center gap-2 rounded-full border border-stroke bg-white
                px-4 py-2 text-xs font-medium text-dark shadow-sm
                hover:bg-gray-2
                dark:border-dark-3 dark:bg-dark-2 dark:text-white dark:hover:bg-dark-2/80
              "
            >
              <Icons.Calendar className="h-4 w-4" />
              <span className="hidden md:inline">Calendario</span>
            </button>
          )
        }
      />

      {/* PARTECIPANTI */}
      <AulaPartecipantiPanel
        aula={current}
        isLoading={isLoading}
        anagraficaLabel={anagDef.label}
        anagSlug={aulaDef.anagraficaSlug}
        anagraficaItems={anagItems}
        dynamicFields={partecipanteFields}
        alerts={[]}
        urgentAlerts={[]}
      />

      {/* ALLEGATI AULA */}
      <AttachmentsPanel
        title="Materiali Didattici"
        loading={isLoading}
        items={attachmentItems}
        emptyMessage="Nessun allegato per questa aula."
        viewLabel="View"
      />
    </div>
  );
}
