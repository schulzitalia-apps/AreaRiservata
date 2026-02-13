// src/components/Aule/AulaEdit.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAppDispatch, useAppSelector } from "@/components/Store/hooks";
import {
  fetchAulaById,
  saveAula,
  uploadAulaAttachment,
  deleteAulaAttachment,
} from "@/components/Store/slices/auleSlice";
import { fetchAnagrafiche } from "@/components/Store/slices/anagraficheSlice";

import { getAulaDef } from "@/config/aule.registry";
import {
  AULA_PARTECIPANTE_FIELD_CATALOG,
  type AulaPartecipanteFieldKey,
  type AulaPartecipanteFieldDef,
} from "@/config/aule.fields.catalog";
import { getAnagraficaDef } from "@/config/anagrafiche.registry";

import type {
  AulaDetail,
  AulaPartecipanteDetail,
} from "@/components/Store/models/aule";
import type { AnagraficaPreview } from "@/components/Store/models/anagrafiche";

import { EditForm } from "@/components/AtlasModuli/common/EditForm";
import {
  EditAttachmentsPanel,
  type EditAttachment,
} from "@/components/AtlasModuli/common/EditAttachmentsPanel";
import { EditPartecipantiPanel } from "@/components/AtlasModuli/common/EditPartecipantiPanel";

type LocalPartecipante = {
  anagraficaId: string;
  joinedAt: string;
  dati: Record<AulaPartecipanteFieldKey, any>;
};

type Props = { id?: string; type: string };

export default function AulaEdit({ id, type }: Props) {
  const router = useRouter();
  const dispatch = useAppDispatch();

  const aulaDef = getAulaDef(type);
  const anagDef = getAnagraficaDef(aulaDef.anagraficaSlug);

  const FIELDS = aulaDef.fields;

  const PARTECIPANT_KEYS = useMemo(
    () =>
      Object.keys(
        AULA_PARTECIPANTE_FIELD_CATALOG,
      ) as AulaPartecipanteFieldKey[],
    [],
  );
  const PARTECIPANT_DEFS = AULA_PARTECIPANTE_FIELD_CATALOG;

  const current = useAppSelector((s) => s.aule.current);
  const currentStatus = useAppSelector((s) => s.aule.currentStatus);
  const attachments = (current?.attachments ?? []) as EditAttachment[];

  const anagBucket = useAppSelector(
    (s) => s.anagrafiche.byType[aulaDef.anagraficaSlug],
  );
  const anagItems = anagBucket?.items ?? [];

  const [anagQuery, setAnagQuery] = useState("");
  const [saving, setSaving] = useState(false);
  const [initDone, setInitDone] = useState(false);

  const [formPartecipanti, setFormPartecipanti] = useState<LocalPartecipante[]>(
    [],
  );

  // cache preview
  const [anagPreviewCache, setAnagPreviewCache] = useState<
    Record<string, AnagraficaPreview>
  >({});

  useEffect(() => {
    if (!anagItems.length) return;
    setAnagPreviewCache((prev) => {
      const next = { ...prev };
      for (const a of anagItems) next[a.id] = a;
      return next;
    });
  }, [anagItems]);

  useEffect(() => {
    if (!id) {
      setInitDone(true);
      return;
    }
    dispatch(fetchAulaById({ type, id }));
  }, [dispatch, id, type]);

  useEffect(() => {
    if (!id) return;
    if (!current || current.id !== id) return;

    const aula: AulaDetail = current;
    const nextPartecipanti: LocalPartecipante[] =
      aula.partecipanti?.map((p) => ({
        anagraficaId: p.anagraficaId,
        joinedAt: p.joinedAt ?? new Date().toISOString(),
        dati: Object.fromEntries(
          PARTECIPANT_KEYS.map((key) => [key, p.dati?.[key] ?? ""]),
        ) as any,
      })) ?? [];

    setFormPartecipanti(nextPartecipanti);
    setInitDone(true);
  }, [current, id, PARTECIPANT_KEYS]);

  useEffect(() => {
    dispatch(
      fetchAnagrafiche({
        type: aulaDef.anagraficaSlug,
        query: anagQuery || undefined,
      }),
    );
  }, [dispatch, aulaDef.anagraficaSlug, anagQuery]);

  const initialBase = {
    data: current?.campi ?? {},
    visibilityRole: current?.visibilityRole ?? null,
  };

  const handleSubmit = async (base: {
    data: Record<string, any>;
    visibilityRole: string | null;
  }) => {
    setSaving(true);
    try {
      const payloadPartecipanti: AulaPartecipanteDetail[] =
        formPartecipanti.map((p) => ({
          anagraficaId: p.anagraficaId,
          joinedAt: p.joinedAt,
          dati: p.dati,
        }));

      const res = await dispatch(
        saveAula({
          type,
          id,
          campi: base.data,
          partecipanti: payloadPartecipanti,
          visibilityRole: base.visibilityRole,
        } as any),
      ).unwrap();

      const aulaId = (res as any).id ?? id;
      router.push(`/aule/${type}/${aulaId}`);
    } finally {
      setSaving(false);
    }
  };

  const isLoading = currentStatus === "loading" && !!id && !initDone;
  if (!initDone || isLoading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="h-16 animate-pulse rounded bg-gray-2 dark:bg-dark-2"
          />
        ))}
      </div>
    );
  }

  const headerTitle = id ? "Modifica aula" : "Nuova aula";

  // 🔹 Stile grafico preso dalla config (come per viewer/anagrafiche)
  const coverSrc = aulaDef.detailCard.coverSrc;
  const avatarSrc = aulaDef.detailCard.avatarSrc;
  const headerVariant = aulaDef.detailCard.headerVariant;
  const avatarSize = aulaDef.detailCard.avatarSize;
  const hoverEffect = aulaDef.detailCard.hoverEffect;

  return (
    <div className="space-y-6">
      {/* 1) Scheda principale aula (FloatingSection + campi) */}
      <EditForm
        title={headerTitle}
        subtitle={aulaDef.label}
        backHref={`/aule/${type}`}
        coverSrc={coverSrc}
        avatarSrc={avatarSrc}
        headerVariant={headerVariant}
        avatarSize={avatarSize}
        hoverEffect={hoverEffect}
        fields={FIELDS as any}
        visibilityOptions={aulaDef.visibilityOptions as any}
        initial={initialBase}
        saving={saving}
        onSubmit={handleSubmit}
      />

      {/* 2) Pannello partecipanti - STACCATO dal form principale */}
      <EditPartecipantiPanel<LocalPartecipante>
        title={`Partecipanti (${anagDef.label})`}
        anagraficaTypes={[
          { slug: aulaDef.anagraficaSlug, label: anagDef.label },
        ]}
        selectedTypeSlug={aulaDef.anagraficaSlug}
        partecipanti={formPartecipanti}
        onChangePartecipanti={setFormPartecipanti}
        availableItems={anagItems}
        availableQuery={anagQuery}
        onChangeAvailableQuery={setAnagQuery}
        previewById={anagPreviewCache}
        selectedListTitle="Partecipanti Aula"
        emptySelectedMessage="Nessun partecipante selezionato."
        groupByType={false}
        buildNewPartecipante={({ anagrafica }) => ({
          anagraficaId: anagrafica.id,
          joinedAt: new Date().toISOString(),
          dati: Object.fromEntries(PARTECIPANT_KEYS.map((k) => [k, ""])) as any,
        })}
        renderDetails={({ partecipante, patch }) => (
          <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
            {PARTECIPANT_KEYS.map((key) => {
              const defField: AulaPartecipanteFieldDef = PARTECIPANT_DEFS[key];
              const v = partecipante.dati[key];

              if (defField.type === "textarea") {
                return (
                  <TextareaInside
                    key={key}
                    label={defField.label}
                    value={v}
                    onChange={(val) =>
                      patch({
                        dati: {
                          ...partecipante.dati,
                          [key]: val,
                        },
                      })
                    }
                  />
                );
              }

              return (
                <InputInside
                  key={key}
                  label={defField.label}
                  type={defField.type}
                  value={v}
                  onChange={(val) =>
                    patch({
                      dati: {
                        ...partecipante.dati,
                        [key]: val,
                      },
                    })
                  }
                />
              );
            })}

            <div className="mt-2 text-[11px] text-dark/60 dark:text-white/60 md:col-span-2">
              In aula dal{" "}
              {new Date(partecipante.joinedAt).toLocaleDateString()}
            </div>
          </div>
        )}
      />

      {/* 3) Allegati aula */}
      <EditAttachmentsPanel
        documentTypes={aulaDef.documentTypes ?? ["altro"]}
        attachments={attachments}
        canUpload={!!current?.id}
        onUpload={async ({ file, attachmentType, title }) => {
          if (!current?.id) return;
          const fd = new FormData();
          fd.append("file", file, file.name);
          fd.append("attachmentType", attachmentType);
          if (title) fd.append("title", title);
          await dispatch(
            uploadAulaAttachment({
              type,
              id: current.id,
              form: fd,
              attachmentType,
            }),
          ).unwrap();
        }}
        onDelete={async (attId) => {
          if (!current?.id) return;
          await dispatch(
            deleteAulaAttachment({
              type,
              id: current.id,
              attachmentId: attId,
              removeDocument: false,
            }),
          ).unwrap();
        }}
      />
    </div>
  );
}

/* piccoli helper locali per i campi partecipante */

function InputInside({
                       label,
                       value,
                       onChange,
                       type = "text",
                     }: {
  label: string;
  value: any;
  onChange: (v: string) => void;
  type?: string;
}) {
  return (
    <label className="block text-xs text-dark dark:text-white">
      <div className="mb-1">{label}</div>
      <input
        className="w-full rounded-lg border border-stroke bg-transparent px-2 py-1 text-xs text-dark outline-none focus:border-primary dark:border-dark-3 dark:bg-transparent dark:text-white"
        type={type}
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}

function TextareaInside({
                          label,
                          value,
                          onChange,
                          rows = 3,
                        }: {
  label: string;
  value: any;
  onChange: (v: string) => void;
  rows?: number;
}) {
  return (
    <label className="block text-xs text-dark dark:text-white md:col-span-2">
      <div className="mb-1">{label}</div>
      <textarea
        rows={rows}
        className="w-full rounded-lg border border-stroke bg-transparent px-2 py-1 text-xs text-dark outline-none focus:border-primary dark:border-dark-3 dark:bg-transparent dark:text-white"
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}
