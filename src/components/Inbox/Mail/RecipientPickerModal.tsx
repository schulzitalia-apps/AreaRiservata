"use client";

import { useEffect, useMemo, useState } from "react";
import { cn } from "@/server-utils/lib/utils";
import { Modal } from "@/components/ui/Modal";
import { Select } from "@/components/ui/select";

import { ANAGRAFICA_TYPES } from "@/config/anagrafiche.types.public";
import { AULE_TYPES } from "@/config/aule.types.public";

import type {
  AnagraficaPreview,
  AnagraficaFull,
} from "@/components/Store/models/anagrafiche";
import type { AulaPreview, AulaDetail } from "@/components/Store/models/aule";
import {
  fetchAnagrafiche,
  fetchAnagrafica,
} from "@/components/Store/slices/anagraficheSlice";
import {
  fetchAuleByType,
  fetchAulaById,
} from "@/components/Store/slices/auleSlice";
import { useAppDispatch, useAppSelector } from "@/components/Store/hooks";

import { extractEmailsDeep, getDocData } from "./utils/extractEmails";

type AnagraficaNode = { typeSlug: string; id: string; data: Record<string, any> };
type AnagraficaPack = { root: AnagraficaNode; related: AnagraficaNode[]; emails: string[] };

export type PickedRecipient = {
  sourceKind: "ANAGRAFICA" | "AULA";
  typeSlug: string;
  id: string;
  label: string;
  emails: string[];
  allEmails?: string[];
  data?: Record<string, any>;
  related?: AnagraficaNode[];
};

type Props = {
  open: boolean;
  onClose: () => void;
  onPick: (picked: PickedRecipient) => void;
  mode?: "primary" | "cc";
  allowAule?: boolean;
};

type SourceKind = "anagrafiche" | "aule";

function getAnagraficaItemLabel(item: AnagraficaPreview): string {
  const anyItem = item as any;
  return anyItem.displayName || anyItem.title || anyItem.name || anyItem.label || anyItem.codice || item.id;
}

function getAulaItemLabel(item: AulaPreview): string {
  return item.label || item.id;
}

async function jsonFetch<T = any>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { ...init, credentials: "include" });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json?.error || json?.message || `HTTP_${res.status}`);
  return json as T;
}

function extractEmailsFromAulaDetail(aula: AulaDetail | undefined): string[] {
  if (!aula) return [];
  return extractEmailsDeep({
    campi: aula.campi || {},
    partecipanti: aula.partecipanti || [],
    maestri: aula.maestri || [],
  });
}

export default function RecipientPickerModal({
  open,
  onClose,
  onPick,
  mode = "primary",
  allowAule = false,
}: Props) {
  const dispatch = useAppDispatch();

  const [sourceKind, setSourceKind] = useState<SourceKind>("anagrafiche");
  const [entityType, setEntityType] = useState<string>(
    (ANAGRAFICA_TYPES?.[0] as any)?.slug || "clienti",
  );
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string>("");
  const [step, setStep] = useState<"list" | "chooseEmail">("list");
  const [pickedDraft, setPickedDraft] = useState<PickedRecipient | null>(null);
  const [emailChoice, setEmailChoice] = useState<string>("");
  const [selecting, setSelecting] = useState(false);

  const anagraficaBucket = useAppSelector((s: any) => s.anagrafiche?.byType?.[entityType]);
  const aulaBucket = useAppSelector((s: any) => s.aule?.byType?.[entityType]);

  const items = sourceKind === "anagrafiche"
    ? ((anagraficaBucket?.items || []) as AnagraficaPreview[])
    : ((aulaBucket?.items || []) as AulaPreview[]);
  const status = sourceKind === "anagrafiche"
    ? String(anagraficaBucket?.status || "idle")
    : String(aulaBucket?.status || "idle");

  useEffect(() => {
    if (!open) return;
    setStep("list");
    setPickedDraft(null);
    setSelectedId("");
    setEmailChoice("");
    setSelecting(false);
    setSourceKind("anagrafiche");
    setEntityType((ANAGRAFICA_TYPES?.[0] as any)?.slug || "clienti");
  }, [open]);

  useEffect(() => {
    if (!open) return;

    const t = setTimeout(() => {
      if (sourceKind === "anagrafiche") {
        dispatch(
          fetchAnagrafiche({
            type: entityType,
            query: query.trim() || undefined,
            page: 1,
            pageSize: 20,
          }) as any,
        );
        return;
      }

      dispatch(
        fetchAuleByType({
          type: entityType,
          query: query.trim() || undefined,
          page: 1,
          pageSize: 20,
        }) as any,
      );
    }, 250);

    return () => clearTimeout(t);
  }, [open, sourceKind, entityType, query, dispatch]);

  const sourceOptions = useMemo(
    () => [
      ["anagrafiche", "Anagrafiche"],
      ...(allowAule ? ([["aule", "Aule"]] as const) : []),
    ],
    [allowAule],
  );

  const typeOptions = useMemo(() => {
    if (sourceKind === "anagrafiche") {
      return (ANAGRAFICA_TYPES || []).map((t: any) => [t.slug as string, t.label as string] as const);
    }
    return (AULE_TYPES || []).map((t: any) => [t.slug as string, t.label as string] as const);
  }, [sourceKind]);

  useEffect(() => {
    const firstType = sourceKind === "anagrafiche"
      ? (ANAGRAFICA_TYPES?.[0] as any)?.slug || "clienti"
      : (AULE_TYPES?.[0] as any)?.slug || "";
    setEntityType(firstType);
    setSelectedId("");
  }, [sourceKind]);

  async function selectAnagraficaItem(item: AnagraficaPreview) {
    const id = item.id;
    const label = getAnagraficaItemLabel(item);

    const res = await dispatch(fetchAnagrafica({ type: entityType, id }) as any);
    const full: AnagraficaFull | undefined = res?.payload?.data;
    const anyFull = full as any;

    try {
      const packRes = await jsonFetch<{ ok: true; pack: AnagraficaPack }>("/api/anagrafiche/pack", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ typeSlug: entityType, id }),
      });

      const pack = packRes.pack;
      const allEmails = Array.isArray(pack?.emails) ? pack.emails : [];
      const rootData = pack?.root?.data && typeof pack.root.data === "object" ? pack.root.data : {};
      const related = Array.isArray(pack?.related) ? pack.related : [];

      return {
        sourceKind: "ANAGRAFICA" as const,
        typeSlug: entityType,
        id,
        label,
        emails: allEmails.length ? [allEmails[0]] : [],
        allEmails,
        data: rootData,
        related,
      };
    } catch {
      const data = getDocData(anyFull);
      const emails = extractEmailsDeep(data);

      return {
        sourceKind: "ANAGRAFICA" as const,
        typeSlug: entityType,
        id,
        label,
        emails,
        allEmails: emails,
        data,
        related: [],
      };
    }
  }

  async function selectAulaItem(item: AulaPreview) {
    const id = item.id;
    const label = getAulaItemLabel(item);

    const res = await dispatch(fetchAulaById({ type: entityType, id }) as any);
    const detail: AulaDetail | undefined = res?.payload as AulaDetail | undefined;
    const emails = extractEmailsFromAulaDetail(detail);

    return {
      sourceKind: "AULA" as const,
      typeSlug: entityType,
      id,
      label,
      emails,
      allEmails: emails,
      data: detail?.campi || {},
      related: [],
    };
  }

  async function selectItem(item: AnagraficaPreview | AulaPreview) {
    if (selecting) return;

    const id = item.id;
    setSelectedId(id);
    setSelecting(true);

    try {
      const draft = sourceKind === "anagrafiche"
        ? await selectAnagraficaItem(item as AnagraficaPreview)
        : await selectAulaItem(item as AulaPreview);

      const allEmails = draft.allEmails || draft.emails || [];

      if (allEmails.length <= 1) {
        onPick({ ...draft, emails: allEmails.length ? [allEmails[0]] : [] });
        onClose();
        return;
      }

      setPickedDraft(draft);
      setEmailChoice(allEmails[0] || "");
      setStep("chooseEmail");
    } finally {
      setSelecting(false);
    }
  }

  function confirmEmailChoice() {
    if (!pickedDraft) return;
    const chosen = emailChoice.trim();
    const finalEmails = chosen ? [chosen] : pickedDraft.emails;
    onPick({ ...pickedDraft, emails: finalEmails });
    onClose();
  }

  const title = mode === "cc" ? "Aggiungi destinatario in copia" : "Seleziona destinatario";
  const subtitle =
    mode === "cc"
      ? "Cerca nelle anagrafiche o nelle aule e aggiungi un indirizzo in CC."
      : "Cerca nelle anagrafiche e compila automaticamente il destinatario principale.";

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      subtitle={subtitle}
      maxWidthClassName="max-w-[820px]"
      disableClose={false}
      zIndexClassName="z-[90]"
    >
      {step === "list" ? (
        <>
          <div className={cn("grid gap-3", allowAule ? "md:grid-cols-[180px,220px,1fr]" : "md:grid-cols-[220px,1fr]")}>
            {allowAule ? (
              <div className="text-sm">
                <Select
                  label="Sorgente"
                  value={sourceKind}
                  onChange={(v) => setSourceKind(v as SourceKind)}
                  options={sourceOptions as any}
                  disabled={selecting || status === "loading"}
                />
              </div>
            ) : null}

            <div className="text-sm">
              <Select
                label="Tipo"
                value={entityType}
                onChange={setEntityType}
                options={typeOptions as any}
                disabled={selecting || status === "loading"}
              />
            </div>

            <label className="text-xs text-dark dark:text-white">
              Cerca
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={sourceKind === "anagrafiche" ? "nome, codice, email..." : "nome aula, indirizzo, email..."}
                disabled={selecting}
                className={cn(
                  "mt-1 w-full rounded-xl border border-stroke bg-transparent px-3 py-2 text-sm outline-none focus:border-primary",
                  "dark:border-dark-3 dark:text-white",
                  selecting && "opacity-70",
                )}
              />
            </label>
          </div>

          <div className="mt-4 rounded-xl border border-stroke dark:border-dark-3">
            <div className="flex items-center justify-between border-b border-stroke px-3 py-2 text-xs dark:border-dark-3">
              <span className="font-semibold text-dark/80 dark:text-white/80">Risultati</span>
              <span className="text-dark/60 dark:text-white/60">
                {selecting || status === "loading" ? "Caricamento..." : `${items.length} elementi`}
              </span>
            </div>

            <div className="max-h-[420px] overflow-y-auto p-2">
              {items.length === 0 ? (
                <div className="p-6 text-center text-sm text-dark/60 dark:text-white/60">
                  Nessun risultato.
                </div>
              ) : (
                <ul className="space-y-2">
                  {items.map((it: any) => {
                    const active = it.id === selectedId;
                    const label = sourceKind === "anagrafiche"
                      ? getAnagraficaItemLabel(it as AnagraficaPreview)
                      : getAulaItemLabel(it as AulaPreview);

                    return (
                      <li key={it.id}>
                        <button
                          onClick={() => selectItem(it)}
                          disabled={selecting}
                          className={cn(
                            "w-full rounded-xl border px-3 py-3 text-left transition-colors",
                            "border-stroke dark:border-dark-3",
                            active
                              ? "border-primary bg-red-100/60 dark:bg-red-900/30"
                              : "hover:bg-gray-2 dark:hover:bg-dark-2",
                            selecting && "cursor-not-allowed opacity-70",
                          )}
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div className="min-w-0">
                              <div className="truncate text-sm font-semibold text-dark dark:text-white">
                                {label}
                              </div>
                              <div className="mt-0.5 truncate text-[11px] text-dark/60 dark:text-white/60">
                                {sourceKind === "anagrafiche" ? "Scheda" : "Aula"}: <span className="font-mono">{it.id}</span>
                              </div>
                            </div>

                            <span className="rounded-full bg-gray-2 px-2 py-0.5 text-[11px] font-semibold text-dark dark:bg-dark-2 dark:text-white">
                              Seleziona
                            </span>
                          </div>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
        </>
      ) : (
        <div className="rounded-xl border border-stroke p-3 dark:border-dark-3">
          <div className="text-sm font-semibold text-dark dark:text-white">
            Questo record ha piu email
          </div>
          <div className="mt-1 text-xs text-dark/60 dark:text-white/60">
            Scegli quale indirizzo usare.
          </div>

          <div className="mt-3 space-y-2">
            {(pickedDraft?.allEmails || pickedDraft?.emails || []).map((email) => (
              <label
                key={email}
                className="flex cursor-pointer items-center gap-2 rounded-xl border border-stroke px-3 py-2 text-sm dark:border-dark-3"
              >
                <input
                  type="radio"
                  name="emailChoice"
                  checked={emailChoice === email}
                  onChange={() => setEmailChoice(email)}
                />
                <span className="font-mono">{email}</span>
              </label>
            ))}
          </div>

          <div className="mt-4 flex items-center gap-2">
            <button
              onClick={() => {
                setStep("list");
                setPickedDraft(null);
                setEmailChoice("");
              }}
              className="rounded-xl border border-stroke px-4 py-2 text-sm font-semibold text-dark hover:bg-gray-2 dark:border-dark-3 dark:text-white dark:hover:bg-dark-2"
            >
              Indietro
            </button>

            <button
              onClick={confirmEmailChoice}
              className="ml-auto rounded-xl bg-primary px-4 py-2 text-sm font-bold text-white hover:opacity-90"
            >
              Usa questa email
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}
