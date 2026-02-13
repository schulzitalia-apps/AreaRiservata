"use client";

import { useEffect, useMemo } from "react";
import { useAppDispatch, useAppSelector } from "@/components/Store/hooks";
import { fetchEvento } from "@/components/Store/slices/eventiSlice";
import { getEventoDef } from "@/config/eventi.registry";

import {
  DetailInfoCard,
  type DetailField,
} from "@/components/AtlasModuli/common/DetailInfoCard";
import {
  AttachmentsPanel,
  type AttachmentViewItem,
} from "@/components/AtlasModuli/common/AttachmentsPanel";
import { InfoPill } from "@/components/AtlasModuli/common/InfoPill";

import type { AttachmentView, EventoFull } from "@/components/Store/models/eventi";

// ✅ NEW
import EventoPartecipazionePills from "@/components/AtlasModuli/Eventi/Partecipanti/EventoPartecipazionePills";

// 🔐 permessi evento
import type { EventoTypeSlug } from "@/config/eventi.types.public";
import { useEventoCrudPermissions } from "@/components/AtlasModuli/useCrudPermissions";

type Props = {
  type: string;
  id: string;
};

export default function EventoViewer({ type, id }: Props) {
  const def = getEventoDef(type);
  const dispatch = useAppDispatch();

  const { canEdit } = useEventoCrudPermissions(type as EventoTypeSlug);

  const selected = useAppSelector(
    (s) => s.eventi.byType[type]?.selected as EventoFull | null | undefined,
  );

  useEffect(() => {
    if (id) dispatch(fetchEvento({ type, id }));
  }, [dispatch, type, id]);

  const isLoading = !selected || selected.id !== id;

  const fieldKeys = useMemo(
    () => Object.keys(def.fields) as Array<keyof typeof def.fields>,
    [def.fields],
  );

  const displayName = useMemo(() => {
    const vals = def.preview.title
      .map((k) => selected?.data?.[k] ?? "")
      .filter(Boolean);
    return vals.join(" ") || "(evento senza titolo)";
  }, [def.preview.title, selected]);

  const visibilityLabel = selected?.visibilityRole || "Solo proprietario";

  const formatDateTime = (iso?: string | null, allDay?: boolean) => {
    if (!iso) return "";
    const d = new Date(iso);
    const date = d.toLocaleDateString();
    if (allDay) return date;
    const time = d.toLocaleTimeString(undefined, {
      hour: "2-digit",
      minute: "2-digit",
    });
    return `${date} • ${time}`;
  };

  const timeLabel = useMemo(() => {
    if (!selected) return "";
    const { timeKind, startAt, endAt, allDay } = selected;

    const startStr = formatDateTime(startAt, allDay);
    const endStr = formatDateTime(endAt, allDay);

    switch (timeKind) {
      case "point":
        return startStr || "Evento puntuale";
      case "interval":
        if (startStr && endStr) return `${startStr} → ${endStr}`;
        if (startStr) return `Da ${startStr}`;
        if (endStr) return `Fino a ${endStr}`;
        return "Intervallo";
      case "deadline":
        return startStr ? `Scadenza: ${startStr}` : "Scadenza";
      case "recurring_master":
        return startStr
          ? `Evento ricorrente da ${startStr}`
          : "Evento ricorrente";
      case "recurring_occurrence":
        return startStr
          ? `Occorrenza del ${startStr}`
          : "Occorrenza ricorrente";
      default:
        return "";
    }
  }, [selected]);

  const infoFields: DetailField[] = useMemo(() => {
    if (!selected) return [];

    const fields: DetailField[] = [];

    fieldKeys.forEach((k) => {
      const fld = def.fields[k] as any;
      let val: any = (selected as any).data?.[k as string];

      if (fld.type === "date" && val) {
        val = new Date(val).toLocaleDateString();
      }
      if (fld.type === "datetime" && val) {
        const d = new Date(val);
        val = `${d.toLocaleDateString()} ${d.toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        })}`;
      }

      if (val === null || val === undefined || val === "") val = "—";

      fields.push({
        id: String(k),
        label: fld.label,
        value: String(val),
      });
    });

    if (selected.createdAt) {
      fields.push({
        id: "_createdAt",
        label: "Creato il",
        value: new Date(selected.createdAt).toLocaleString(),
      });
    }
    if (selected.updatedAt) {
      fields.push({
        id: "_updatedAt",
        label: "Ultima modifica",
        value: new Date(selected.updatedAt).toLocaleString(),
      });
    }

    return fields;
  }, [fieldKeys, def.fields, selected]);

  const attachmentItems: AttachmentViewItem[] = useMemo(() => {
    const attachments: AttachmentView[] = Array.isArray(selected?.attachments)
      ? (selected!.attachments as AttachmentView[])
      : [];

    return attachments.map((a) => ({
      id: a._id,
      title: a.document?.title || `(doc ${a.documentId})`,
      href: `/api/documents/${a.documentId}/view`,
      category: a.document?.category || "altro",
      type: a.type,
      uploadedAt: a.uploadedAt ?? null,
    }));
  }, [selected]);

  const coverSrc = def.detailCard.coverSrc;
  const avatarSrc = def.detailCard.avatarSrc;
  const headerVariant = def.detailCard.headerVariant;
  const avatarSize = def.detailCard.avatarSize;
  const hoverEffect = def.detailCard.hoverEffect;

  return (
    <div className="space-y-6">
      <DetailInfoCard
        title={displayName}
        loading={isLoading}
        backHref={`/eventi/${type}`}
        editHref={`/eventi/${type}/${id}/edit`}
        canEdit={canEdit}
        pills={
          <>
            <InfoPill tone="success">Tipo evento: {def.label}</InfoPill>

            {timeLabel && <InfoPill tone="success">{timeLabel}</InfoPill>}

            {/* ✅ PARTECIPAZIONE: usa preview.title per mostrare il “nome” giusto */}
            <EventoPartecipazionePills
              evento={selected ?? null}
              eventoType={type}
              eventoId={id}
              maxPartecipanti={8}
            />

            <InfoPill tone="rose">Visibilità: {visibilityLabel}</InfoPill>
          </>
        }
        fields={infoFields}
        coverSrc={coverSrc}
        avatarSrc={avatarSrc}
        headerVariant={headerVariant}
        avatarSize={avatarSize}
        hoverEffect={hoverEffect}
      />

      <AttachmentsPanel
        title="Allegati"
        loading={isLoading}
        items={attachmentItems}
        emptyMessage="Nessun allegato"
        viewLabel="View"
      />
    </div>
  );
}
