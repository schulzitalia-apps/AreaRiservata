// src/components/Eventi/EventoEdit.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { useAppDispatch, useAppSelector } from "@/components/Store/hooks";
import {
  fetchEvento,
  createEvento,
  updateEvento,
  uploadEventoAttachment,
  deleteEventoAttachment,
} from "@/components/Store/slices/eventiSlice";

import { fetchAnagrafiche } from "@/components/Store/slices/anagraficheSlice";
import { fetchAuleByType } from "@/components/Store/slices/auleSlice";

import { getEventoDef } from "@/config/eventi.registry";
import { getAnagraficaDef } from "@/config/anagrafiche.registry";
import { getAulaDef } from "@/config/aule.registry";
import type { AllowedTimeKind } from "@/config/eventi.types.public";

import type {
  EventoFull,
  EventoPartecipanteView,
} from "@/components/Store/models/eventi";
import type { AnagraficaPreview } from "@/components/Store/models/anagrafiche";
import type { AulaPreview } from "@/components/Store/models/aule";

import { Select } from "@/components/ui/select";
import {
  EditForm,
  type EditFieldDef,
} from "@/components/AtlasModuli/common/EditForm";
import {
  EditAttachmentsPanel,
  type EditAttachment,
} from "@/components/AtlasModuli/common/EditAttachmentsPanel";
import { EditPartecipantiPanel } from "@/components/AtlasModuli/common/EditPartecipantiPanel";

/* -------------------------------------------------------------------------- */
/*                                 HELPERS                                    */
/* -------------------------------------------------------------------------- */

function shortId(id: string, keep = 10) {
  return id.length > keep ? `${id.slice(0, keep)}…` : id;
}

function getDataRecord(obj: any): Record<string, any> {
  if (!obj) return {};
  return obj.data && typeof obj.data === "object" ? obj.data : obj;
}

/**
 * Costruisce il testo preview usando una lista di FieldKey / chiavi
 * (es: preview.title = ["numeroOrdine"]).
 */
function buildPreviewTitle(keys: string[] | undefined, obj: any): string {
  const rec = getDataRecord(obj);
  const arr = Array.isArray(keys) ? keys : [];
  const vals = arr
    .map((k) => {
      const v = rec?.[k] ?? obj?.[k];
      if (v === null || v === undefined) return "";
      if (typeof v === "string") return v.trim();
      return String(v);
    })
    .filter(Boolean);

  return vals.join(" ").trim();
}

function formatAnagraficaPreviewLabel(
  item: AnagraficaPreview,
  typeSlug: string,
): string {
  const def: any = getAnagraficaDef(typeSlug);
  const previewKeys: string[] | undefined = def?.preview?.title;

  const title = buildPreviewTitle(previewKeys, item);
  if (title) return title;

  // fallback “safe”
  const anyItem = item as any;
  return (
    (typeof anyItem.label === "string" && anyItem.label) ||
    (typeof anyItem.displayName === "string" && anyItem.displayName) ||
    shortId(item.id, 14)
  );
}

function formatAulaPreviewLabel(item: AulaPreview): string {
  const def: any = getAulaDef((item as any).tipo);
  const previewKeys: string[] | undefined = def?.preview?.title;

  const title = buildPreviewTitle(previewKeys, item);
  if (title) return title;

  const anyItem = item as any;
  return (
    (typeof anyItem.label === "string" && anyItem.label) ||
    (typeof anyItem.displayName === "string" && anyItem.displayName) ||
    shortId(item.id, 14)
  );
}

/* -------------------------------------------------------------------------- */
/*                                 TIPI LOCALI                                */
/* -------------------------------------------------------------------------- */

type Props = { id?: string; type: string };

type RecurrenceForm = {
  rrule: string;
  until: string;
  count: string;
};

type LocalPartecipante = {
  anagraficaType: string;
  anagraficaId: string;
  role?: string | null;
  status?: string | null;
  quantity?: number | null;
  note?: string | null;
};

/* -------------------------------------------------------------------------- */
/*                               COMPONENTE                                   */
/* -------------------------------------------------------------------------- */

export default function EventoEdit({ id, type }: Props) {
  const router = useRouter();
  const dispatch = useAppDispatch();

  const eventoDef = getEventoDef(type);

  /* ------------------------------ REDUX EVENTO ----------------------------- */

  const bucket = useAppSelector((s) => s.eventi.byType[type]);
  const current = bucket?.selected ?? null;
  const currentStatus = bucket?.status ?? "idle";

  const attachments = (current?.attachments ?? []) as EditAttachment[];

  /* -------------------------- STATO BASE EVENTO ---------------------------- */

  // time & scheduling
  const [timeKind, setTimeKind] = useState<AllowedTimeKind>(
    eventoDef.allowedTimeKinds[0] ?? ("point" as AllowedTimeKind),
  );
  const [startAt, setStartAt] = useState<string>("");
  const [endAt, setEndAt] = useState<string>("");
  const [allDay, setAllDay] = useState<boolean>(false);

  const [recurrence, setRecurrence] = useState<RecurrenceForm>({
    rrule: "",
    until: "",
    count: "",
  });

  // gruppo / aula
  const [gruppo, setGruppo] = useState<{
    gruppoType: string | null;
    gruppoId: string | null;
  }>({ gruppoType: null, gruppoId: null });

  // partecipanti
  const [partecipanti, setPartecipanti] = useState<LocalPartecipante[]>([]);

  // stato di init / saving
  const [initDone, setInitDone] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);

  /* ----------------------------- CAMPI DINAMICI ---------------------------- */

  const FIELDS = eventoDef.fields as Record<string, EditFieldDef>;

  /* ----------------------------- ANAGRAFICHE ------------------------------- */

  const [selectedAnagSlug, setSelectedAnagSlug] = useState<string | null>(
    eventoDef.allowedAnagraficaTypes[0] ?? null,
  );
  const [anagQuery, setAnagQuery] = useState("");

  const anagBucket = useAppSelector((s) =>
    selectedAnagSlug ? s.anagrafiche.byType[selectedAnagSlug] : undefined,
  );
  const anagItems = anagBucket?.items ?? [];

  // ✅ VM: lista anagrafiche con label = preview.title (generico)
  const anagItemsVM = useMemo(() => {
    if (!selectedAnagSlug) return anagItems as any[];
    return (anagItems as any[]).map((a) => ({
      ...a,
      label: formatAnagraficaPreviewLabel(a as any, selectedAnagSlug),
    }));
  }, [anagItems, selectedAnagSlug]);

  const [anagPreviewCache, setAnagPreviewCache] = useState<
    Record<string, AnagraficaPreview>
  >({});

  useEffect(() => {
    if (!selectedAnagSlug) return;
    if (!anagItemsVM.length) return;

    // ✅ cache: anche qui label = preview.title
    setAnagPreviewCache((prev) => {
      const next = { ...prev };
      for (const a of anagItemsVM as any[]) next[a.id] = a;
      return next;
    });
  }, [anagItemsVM, selectedAnagSlug]);

  useEffect(() => {
    if (!selectedAnagSlug) return;
    dispatch(
      fetchAnagrafiche({
        type: selectedAnagSlug,
        query: anagQuery || undefined,
      }),
    );
  }, [dispatch, selectedAnagSlug, anagQuery]);

  /* ------------------------------- AULE / GRUPPO --------------------------- */

  const [selectedAulaType, setSelectedAulaType] = useState<string | null>(
    eventoDef.allowedAulaTypes[0] ?? null,
  );
  const [aulaQuery, setAulaQuery] = useState("");

  const aulaBucket = useAppSelector((s) =>
    selectedAulaType ? s.aule.byType[selectedAulaType] : undefined,
  );
  const aulaItems: AulaPreview[] = aulaBucket?.items ?? [];

  // ✅ VM: lista aule con label = preview.title (generico)
  const aulaItemsVM: AulaPreview[] = useMemo(() => {
    return (aulaItems as any[]).map((a) => ({
      ...a,
      label: formatAulaPreviewLabel(a as any),
    }));
  }, [aulaItems]);

  useEffect(() => {
    if (!selectedAulaType) return;
    dispatch(
      fetchAuleByType({
        type: selectedAulaType,
        query: aulaQuery || undefined,
      }),
    );
  }, [dispatch, selectedAulaType, aulaQuery]);

  /* ------------------------------- ALLEGATI -------------------------------- */

  const [file, setFile] = useState<File | null>(null);
  const [attachmentType, setAttachmentType] = useState<string>(
    (eventoDef as any).documentTypes?.[0] ?? "altro",
  );
  const [uploading, setUploading] = useState(false);

  const handleUploadAttachment = async () => {
    if (!current?.id || !file) return;

    const fd = new FormData();
    fd.append("file", file, file.name);
    fd.append("attachmentType", attachmentType);
    fd.append("title", file.name);

    setUploading(true);
    try {
      await dispatch(
        uploadEventoAttachment({
          type,
          id: current.id,
          form: fd,
        }),
      ).unwrap();
      setFile(null);
    } catch (err: any) {
      alert(err.message || "Errore durante l'upload dell'allegato.");
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteAttachment = async (attachmentId: string) => {
    if (!current?.id) return;
    if (!confirm("Rimuovere questo allegato dall'evento?")) return;

    try {
      await dispatch(
        deleteEventoAttachment({
          type,
          id: current.id,
          attachmentId,
          removeDocument: false,
        }),
      ).unwrap();
    } catch (err: any) {
      alert(err.message || "Errore durante la rimozione dell'allegato.");
    }
  };

  /* ------------------------------ INIT LOAD -------------------------------- */

  // se NUOVO evento -> initDone subito
  useEffect(() => {
    if (!id) {
      setInitDone(true);
      return;
    }
    dispatch(fetchEvento({ type, id }));
  }, [dispatch, id, type]);

  // quando carico evento esistente
  useEffect(() => {
    if (!id) return;
    if (!current || current.id !== id) return;

    const ev: EventoFull = current;

    // timeKind
    const tk: AllowedTimeKind =
      ev.timeKind === "recurring_master" || ev.timeKind === "recurring_occurrence"
        ? ("recurring" as AllowedTimeKind)
        : (ev.timeKind as AllowedTimeKind);
    setTimeKind(tk);

    // start / end
    setStartAt(ev.startAt ? ev.startAt.slice(0, 16) : "");
    setEndAt(ev.endAt ? ev.endAt.slice(0, 16) : "");
    setAllDay(!!ev.allDay);

    // recurrence
    setRecurrence({
      rrule: ev.recurrence?.rrule ?? "",
      until: ev.recurrence?.until ? ev.recurrence.until.slice(0, 10) : "",
      count: ev.recurrence?.count != null ? String(ev.recurrence.count) : "",
    });

    // gruppo
    setGruppo({
      gruppoType: ev.gruppo?.gruppoType ?? null,
      gruppoId: ev.gruppo?.gruppoId ?? null,
    });

    if (ev.gruppo?.gruppoType) {
      setSelectedAulaType(ev.gruppo.gruppoType);
    }

    // partecipanti
    const nextPartecipanti: LocalPartecipante[] =
      ev.partecipanti?.map((p) => ({
        anagraficaId: p.anagraficaId,
        anagraficaType: p.anagraficaType,
        role: p.role ?? null,
        status: p.status ?? null,
        quantity: p.quantity ?? null,
        note: p.note ?? null,
      })) ?? [];
    setPartecipanti(nextPartecipanti);

    setInitDone(true);
  }, [current, id]);

  /* ----------------------------- HANDLER VARI ------------------------------ */

  const handleSelectGruppo = (aula: AulaPreview) => {
    setGruppo({
      gruppoType: (aula as any).tipo,
      gruppoId: aula.id,
    });
  };

  const clearGruppo = () => {
    setGruppo({ gruppoType: null, gruppoId: null });
  };

  /* ------------------------------ SUBMIT BASE ------------------------------ */

  const initialBase = {
    data: current?.data ?? {},
    visibilityRole: current?.visibilityRole ?? null,
  };

  const handleSubmitBase = async (base: {
    data: Record<string, any>;
    visibilityRole: string | null;
  }) => {
    setSaving(true);
    try {
      const payloadPartecipanti: EventoPartecipanteView[] = partecipanti.map((p) => ({
        anagraficaType: p.anagraficaType,
        anagraficaId: p.anagraficaId,
        role: p.role ?? null,
        status: p.status ?? null,
        quantity:
          typeof p.quantity === "number"
            ? p.quantity
            : p.quantity != null
              ? Number(p.quantity)
              : undefined,
        note: p.note ?? null,
      }));

      const recurrencePayload =
        timeKind === "recurring"
          ? {
            rrule: recurrence.rrule || null,
            until: recurrence.until ? new Date(recurrence.until).toISOString() : null,
            count: recurrence.count ? Number(recurrence.count) : null,
            masterId: null,
          }
          : null;

      const payload = {
        data: base.data,
        timeKind: (timeKind === "recurring" ? "recurring_master" : timeKind) as any,
        startAt: startAt ? new Date(startAt).toISOString() : null,
        endAt:
          timeKind === "deadline" && !endAt
            ? null
            : endAt
              ? new Date(endAt).toISOString()
              : null,
        allDay,
        recurrence: recurrencePayload,
        partecipanti: payloadPartecipanti,
        gruppo:
          gruppo.gruppoType && gruppo.gruppoId
            ? {
              gruppoType: gruppo.gruppoType,
              gruppoId: gruppo.gruppoId,
            }
            : null,
        visibilityRole: base.visibilityRole || null,
      };

      let eventoId = id;

      if (id) {
        await dispatch(updateEvento({ type, id, data: payload })).unwrap();
      } else {
        const res = await dispatch(createEvento({ type, payload })).unwrap();
        eventoId = (res as any).id;
      }

      router.push(`/eventi/${type}/${eventoId}`);
    } catch (err: any) {
      alert(err.message || "Errore durante il salvataggio dell'evento.");
    } finally {
      setSaving(false);
    }
  };

  /* ---------------------------- LOADING SKELETON --------------------------- */

  const isLoading = currentStatus === "loading" && !!id && !initDone;

  if (!initDone || isLoading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-16 animate-pulse rounded bg-gray-2 dark:bg-dark-2" />
        ))}
      </div>
    );
  }

  /* ------------------------------ RENDER ----------------------------------- */

  const headerTitle = id ? "Modifica evento" : "Nuovo evento";

  // 🔹 stile header/cover/avatar preso dalla config
  const coverSrc = eventoDef.detailCard.coverSrc;
  const avatarSrc = eventoDef.detailCard.avatarSrc;
  const headerVariant = eventoDef.detailCard.headerVariant;
  const avatarSize = eventoDef.detailCard.avatarSize;
  const hoverEffect = eventoDef.detailCard.hoverEffect;

  return (
    <div className="space-y-6">
      {/* 1) BLOCCO PRINCIPALE: FloatingSection + campi + tempo */}
      <EditForm
        title={headerTitle}
        subtitle={eventoDef.label}
        backHref={`/eventi/${type}`}
        coverSrc={coverSrc}
        avatarSrc={avatarSrc}
        headerVariant={headerVariant}
        avatarSize={avatarSize}
        hoverEffect={hoverEffect}
        fields={FIELDS}
        visibilityOptions={eventoDef.visibilityOptions as any}
        initial={initialBase}
        saving={saving}
        onSubmit={handleSubmitBase}
      >
        {/* --- BLOCCO TEMPO EVENTO (stile dentro la stessa scheda) --- */}
        <div className="mt-4 space-y-3">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {/* TIME KIND */}
            <div className="max-w-xs">
              <Select
                label="Tipo evento"
                value={timeKind}
                options={eventoDef.allowedTimeKinds.map((k) => {
                  switch (k) {
                    case "point":
                      return [k, "Singolo istante"] as [string, string];
                    case "interval":
                      return [k, "Intervallo"] as [string, string];
                    case "deadline":
                      return [k, "Scadenza"] as [string, string];
                    case "recurring":
                      return [k, "Ricorrente"] as [string, string];
                    default:
                      return [k, k] as [string, string];
                  }
                })}
                onChange={(v: string) => setTimeKind(v as AllowedTimeKind)}
              />
            </div>

            {/* ALL DAY */}
            <label className="flex items-center gap-2 text-sm text-dark dark:text-white">
              <input
                type="checkbox"
                checked={allDay}
                onChange={(e) => setAllDay(e.target.checked)}
              />
              <span>Evento per l&apos;intera giornata</span>
            </label>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <ExtraInput label="Inizio" type="datetime-local" value={startAt} onChange={setStartAt} />

            {(timeKind === "interval" || timeKind === "deadline" || timeKind === "recurring") && (
              <ExtraInput
                label={timeKind === "deadline" ? "Scadenza" : "Fine"}
                type="datetime-local"
                value={endAt}
                onChange={setEndAt}
              />
            )}
          </div>

          {timeKind === "recurring" && (
            <div className="mt-2 rounded-lg border border-dashed border-primary/50 p-3 text-sm text-dark dark:text-white">
              <h4 className="mb-2 text-sm font-semibold">Ricorrenza (RRULE)</h4>
              <ExtraInput
                label="RRULE"
                value={recurrence.rrule}
                onChange={(v) => setRecurrence((s) => ({ ...s, rrule: v }))}
              />
              <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-2">
                <ExtraInput
                  label="Fino al (opzionale)"
                  type="date"
                  value={recurrence.until}
                  onChange={(v) => setRecurrence((s) => ({ ...s, until: v }))}
                />
                <ExtraInput
                  label="Numero occorrenze (opzionale)"
                  type="number"
                  value={recurrence.count}
                  onChange={(v) => setRecurrence((s) => ({ ...s, count: v }))}
                />
              </div>
            </div>
          )}
        </div>
      </EditForm>

      {/* 2) BLOCCO GRUPPO / AULA COLLEGATA */}
      {eventoDef.allowedAulaTypes.length > 0 && (
        <div className="rounded-[10px] bg-white p-4 shadow-1 dark:bg-gray-dark">
          <div className="mb-3 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <h3 className="text-base font-semibold text-dark dark:text-white">
              Gruppo / Aula collegata
            </h3>

            <div className="w-full max-w-xs">
              <Select
                label="Tipo aula"
                value={selectedAulaType ?? ""}
                options={eventoDef.allowedAulaTypes.map((slug) => {
                  const def = getAulaDef(slug);
                  return [slug, def.label] as [string, string];
                })}
                onChange={(v: string) => {
                  setSelectedAulaType(v || null);
                  setAulaQuery("");
                }}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {/* LEFT: aule disponibili */}
            <div className="rounded-lg border border-stroke p-3 dark:border-dark-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <span className="text-sm font-semibold text-dark dark:text-white">
                  Aule disponibili
                </span>

                <input
                  className="w-40 rounded-lg border border-stroke bg-transparent px-2 py-1 text-xs text-dark outline-none focus:border-primary dark:border-dark-3 dark:text-white"
                  placeholder="Cerca aula…"
                  value={aulaQuery}
                  onChange={(e) => setAulaQuery(e.target.value)}
                />
              </div>

              <div className="h-64 overflow-auto rounded bg-gray-1/40 p-1 dark:bg-dark-2/60">
                {!aulaItemsVM.length ? (
                  <div className="flex h-full items-center justify-center text-xs text-dark/60 dark:text-white/60">
                    Nessuna aula trovata
                  </div>
                ) : (
                  <div className="space-y-1">
                    {aulaItemsVM.map((a) => (
                      <button
                        key={a.id}
                        type="button"
                        className="flex w-full items-center justify-between rounded border border-stroke bg-white px-3 py-2 text-xs text-dark shadow-sm hover:bg-gray-2/60 dark:border-dark-3 dark:bg-gray-dark dark:text-white"
                        onClick={() => handleSelectGruppo(a)}
                      >
                        <span className="truncate">{(a as any).label}</span>
                        <span className="ml-2 text-[10px] uppercase text-dark/60 dark:text-white/60">
                          Collega
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* RIGHT: gruppo selezionato */}
            <div className="rounded-lg border border-primary/40 bg-primary/5 p-3 text-sm text-dark dark:border-primary/60 dark:text-white">
              <span className="text-sm font-semibold">
                Aula collegata all&apos;evento
              </span>
              <div className="mt-2">
                {gruppo.gruppoType && gruppo.gruppoId ? (
                  <>
                    <div className="mb-1 text-xs uppercase text-dark/60 dark:text-white/60">
                      {getAulaDef(gruppo.gruppoType).label}
                    </div>
                    <div className="mb-2 rounded border border-stroke bg-white px-3 py-2 text-xs text-dark dark:border-dark-3 dark:bg-gray-dark dark:text-white">
                      {(() => {
                        const aula = aulaItemsVM.find((a) => a.id === gruppo.gruppoId);
                        return (aula as any)?.label ?? shortId(gruppo.gruppoId!, 14);
                      })()}
                    </div>
                    <button
                      type="button"
                      onClick={clearGruppo}
                      className="rounded bg-red-500 px-3 py-1 text-xs text-white hover:opacity-90"
                    >
                      Rimuovi collegamento
                    </button>
                  </>
                ) : (
                  <div className="text-xs text-dark/70 dark:text-white/70">
                    Nessuna aula collegata. Puoi lasciarlo vuoto (evento con solo partecipanti
                    singoli) oppure scegliere un&apos;aula come contenitore principale.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 3) BLOCCO PARTECIPANTI (ANAGRAFICHE SINGOLE) */}
      {eventoDef.allowedAnagraficaTypes.length > 0 && (
        <EditPartecipantiPanel<LocalPartecipante>
          title="Partecipanti (anagrafiche singole)"
          anagraficaTypes={eventoDef.allowedAnagraficaTypes.map((slug) => ({
            slug,
            label: getAnagraficaDef(slug).label,
          }))}
          selectedTypeSlug={selectedAnagSlug}
          onChangeSelectedTypeSlug={setSelectedAnagSlug}
          partecipanti={partecipanti}
          onChangePartecipanti={setPartecipanti}
          availableItems={anagItemsVM as any}
          availableQuery={anagQuery}
          onChangeAvailableQuery={setAnagQuery}
          previewById={anagPreviewCache}
          selectedListTitle="Partecipanti Evento"
          emptySelectedMessage="Nessun partecipante selezionato."
          groupByType={true}
          buildNewPartecipante={({ anagrafica, selectedTypeSlug }) => ({
            anagraficaId: (anagrafica as any).id,
            anagraficaType:
              selectedTypeSlug ?? (eventoDef.allowedAnagraficaTypes[0] ?? ""),
            role: null,
            status: null,
            quantity: null,
            note: null,
          })}
          renderDetails={({ partecipante, patch }) => (
            <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
              <ExtraInput
                label="Ruolo"
                value={partecipante.role ?? ""}
                onChange={(val) => patch({ role: val })}
              />
              <ExtraInput
                label="Stato"
                value={partecipante.status ?? ""}
                onChange={(val) => patch({ status: val })}
              />
              <ExtraInput
                label="Quantità"
                type="number"
                value={partecipante.quantity != null ? String(partecipante.quantity) : ""}
                onChange={(val) =>
                  patch({
                    quantity: val ? Number(val) : (null as any),
                  })
                }
              />
              <ExtraTextarea
                label="Note"
                value={partecipante.note ?? ""}
                onChange={(val) => patch({ note: val })}
                rows={2}
              />
            </div>
          )}
        />
      )}

      {/* 4) ALLEGATI EVENTO - loader stile anagrafica */}
      <EditAttachmentsPanel
        documentTypes={((eventoDef as any).documentTypes as string[]) ?? ["altro"]}
        attachments={attachments}
        canUpload={!!current?.id}
        onUpload={async ({ file, attachmentType, title }) => {
          if (!current?.id) return;
          const fd = new FormData();
          fd.append("file", file, file.name);
          fd.append("attachmentType", attachmentType);
          if (title) fd.append("title", title);
          await dispatch(
            uploadEventoAttachment({
              type,
              id: current.id,
              form: fd,
            }),
          ).unwrap();
        }}
        onDelete={async (attId) => {
          if (!current?.id) return;
          await dispatch(
            deleteEventoAttachment({
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

/* -------------------------------------------------------------------------- */
/*                    INPUT / TEXTAREA EXTRA (SEZIONI CUSTOM)                 */
/* -------------------------------------------------------------------------- */

function ExtraInput({
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
    <label className="block text-sm text-dark dark:text-white">
      <div className="mb-1">{label}</div>
      <input
        className="w-full rounded-lg border border-stroke bg-transparent px-3 py-2 text-sm text-dark outline-none focus:border-primary dark:border-dark-3 dark:bg-transparent dark:text-white"
        type={type}
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}

function ExtraTextarea({
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
    <label className="block text-sm text-dark dark:text-white md:col-span-2">
      <div className="mb-1">{label}</div>
      <textarea
        rows={rows}
        className="w-full rounded-lg border border-stroke bg-transparent px-3 py-2 text-sm text-dark outline-none focus:border-primary dark:border-dark-3 dark:bg-transparent dark:text-white"
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}
