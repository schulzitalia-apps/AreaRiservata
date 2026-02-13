// src/components/Mail/RecipientPickerModal.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { cn } from "@/server-utils/lib/utils";
import { Modal } from "@/components/ui/Modal";
import { Select } from "@/components/ui/select";

import { ANAGRAFICA_TYPES } from "@/config/anagrafiche.types.public";

import type { AnagraficaPreview, AnagraficaFull } from "@/components/Store/models/anagrafiche";
import { fetchAnagrafiche, fetchAnagrafica } from "@/components/Store/slices/anagraficheSlice";
import { useAppDispatch, useAppSelector } from "@/components/Store/hooks";

import { extractEmailsDeep, getDocData } from "./utils/extractEmails";

type AnagraficaNode = { typeSlug: string; id: string; data: Record<string, any> };
type AnagraficaPack = { root: AnagraficaNode; related: AnagraficaNode[]; emails: string[] };

type PickedRecipient = {
  scope: "ANAGRAFICA";
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
};

function getItemLabel(item: AnagraficaPreview): string {
  const anyItem = item as any;
  return (
    anyItem.displayName ||
    anyItem.title ||
    anyItem.name ||
    anyItem.label ||
    anyItem.codice ||
    item.id
  );
}

async function jsonFetch<T = any>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { ...init, credentials: "include" });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json?.error || json?.message || `HTTP_${res.status}`);
  return json as T;
}

export default function RecipientPickerModal({ open, onClose, onPick }: Props) {
  const dispatch = useAppDispatch();

  const [typeSlug, setTypeSlug] = useState<string>(
    (ANAGRAFICA_TYPES?.[0] as any)?.slug || "clienti"
  );
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string>("");

  const [step, setStep] = useState<"list" | "chooseEmail">("list");
  const [pickedDraft, setPickedDraft] = useState<PickedRecipient | null>(null);
  const [emailChoice, setEmailChoice] = useState<string>("");

  const [selecting, setSelecting] = useState(false);

  const bucket = useAppSelector((s: any) => s.anagrafiche?.byType?.[typeSlug]);
  const items: AnagraficaPreview[] = bucket?.items || [];
  const status: string = bucket?.status || "idle";

  useEffect(() => {
    if (!open) return;
    setStep("list");
    setPickedDraft(null);
    setSelectedId("");
    setEmailChoice("");
    setSelecting(false);
  }, [open]);

  useEffect(() => {
    if (!open) return;

    const t = setTimeout(() => {
      dispatch(
        fetchAnagrafiche({
          type: typeSlug,
          query: query.trim() || undefined,
          page: 1,
          pageSize: 20,
        }) as any
      );
    }, 250);

    return () => clearTimeout(t);
  }, [open, typeSlug, query, dispatch]);

  // ✅ opzioni per Select "serio"
  const typeOptions = useMemo(() => {
    return (ANAGRAFICA_TYPES || []).map((t: any) => [t.slug as string, t.label as string] as const);
  }, []);

  async function selectItem(item: AnagraficaPreview) {
    if (selecting) return;

    const id = item.id;
    setSelectedId(id);
    setSelecting(true);

    try {
      const res = await dispatch(fetchAnagrafica({ type: typeSlug, id }) as any);
      const full: AnagraficaFull | undefined = res?.payload?.data;
      const anyFull = full as any;

      const label = getItemLabel(item);

      // ✅ Tentativo 1: risolvi reference lato server (pack)
      try {
        const packRes = await jsonFetch<{ ok: true; pack: AnagraficaPack }>("/api/anagrafiche/pack", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ typeSlug, id }),
        });

        const pack = packRes.pack;
        const allEmails = Array.isArray(pack?.emails) ? pack.emails : [];
        const rootData = pack?.root?.data && typeof pack.root.data === "object" ? pack.root.data : {};
        const related = Array.isArray(pack?.related) ? pack.related : [];

        const draft: PickedRecipient = {
          scope: "ANAGRAFICA",
          typeSlug,
          id,
          label,
          emails: allEmails.length ? [allEmails[0]] : [],
          allEmails,
          data: rootData,
          related,
        };

        if (allEmails.length <= 1) {
          onPick({ ...draft, emails: allEmails.length ? [allEmails[0]] : [] });
          onClose();
          return;
        }

        setPickedDraft(draft);
        setEmailChoice(allEmails[0] || "");
        setStep("chooseEmail");
        return;
      } catch {
        // fallback sotto
      }

      // 🟡 Fallback 2: solo root.data
      const data = getDocData(anyFull);
      const emails = extractEmailsDeep(data);

      const draft: PickedRecipient = {
        scope: "ANAGRAFICA",
        typeSlug,
        id,
        label,
        emails,
        allEmails: emails,
        data,
        related: [],
      };

      if (emails.length <= 1) {
        onPick(draft);
        onClose();
        return;
      }

      setPickedDraft(draft);
      setEmailChoice(emails[0] || "");
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

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Seleziona destinatario"
      subtitle="Cerca nelle anagrafiche e compila automaticamente la mail."
      maxWidthClassName="max-w-[820px]"
      disableClose={false}
      zIndexClassName="z-[90]"
    >
      {step === "list" ? (
        <>
          <div className="grid gap-3 md:grid-cols-[220px,1fr]">
            {/* ✅ Select serio */}
            <div className="text-sm">
              <Select
                label="Tipo"
                value={typeSlug}
                onChange={setTypeSlug}
                options={typeOptions as any}
                disabled={selecting || status === "loading"}
              />
            </div>

            <label className="text-xs text-dark dark:text-white">
              Cerca
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="nome, codice, email…"
                disabled={selecting}
                className={cn(
                  "mt-1 w-full rounded-xl border border-stroke bg-transparent px-3 py-2 text-sm outline-none focus:border-primary",
                  "dark:border-dark-3 dark:text-white",
                  selecting && "opacity-70"
                )}
              />
            </label>
          </div>

          <div className="mt-4 rounded-xl border border-stroke dark:border-dark-3">
            <div className="flex items-center justify-between border-b border-stroke px-3 py-2 text-xs dark:border-dark-3">
              <span className="font-semibold text-dark/80 dark:text-white/80">Risultati</span>
              <span className="text-dark/60 dark:text-white/60">
                {selecting || status === "loading" ? "Caricamento…" : `${items.length} elementi`}
              </span>
            </div>

            <div className="max-h-[420px] overflow-y-auto p-2">
              {items.length === 0 ? (
                <div className="p-6 text-center text-sm text-dark/60 dark:text-white/60">
                  Nessun risultato.
                </div>
              ) : (
                <ul className="space-y-2">
                  {items.map((it) => {
                    const active = it.id === selectedId;
                    const label = getItemLabel(it);

                    return (
                      <li key={it.id}>
                        <button
                          onClick={() => selectItem(it)}
                          disabled={selecting}
                          className={cn(
                            "w-full rounded-xl border px-3 py-3 text-left transition-colors",
                            "border-stroke dark:border-dark-3",
                            active
                              ? "bg-red-100/60 border-primary dark:bg-red-900/30"
                              : "hover:bg-gray-2 dark:hover:bg-dark-2",
                            selecting && "opacity-70 cursor-not-allowed"
                          )}
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div className="min-w-0">
                              <div className="truncate text-sm font-semibold text-dark dark:text-white">
                                {label}
                              </div>
                              <div className="mt-0.5 truncate text-[11px] text-dark/60 dark:text-white/60">
                                ID: <span className="font-mono">{it.id}</span>
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

          <div className="mt-3 text-[11px] text-dark/60 dark:text-white/60">
            Tip: se un’anagrafica ha più email (anche via reference), ti chiederò quale usare.
          </div>
        </>
      ) : (
        <div className="rounded-xl border border-stroke p-3 dark:border-dark-3">
          <div className="text-sm font-semibold text-dark dark:text-white">
            Questa anagrafica ha più email
          </div>
          <div className="mt-1 text-xs text-dark/60 dark:text-white/60">
            Scegli quale indirizzo usare come destinatario.
          </div>

          <div className="mt-3 space-y-2">
            {(pickedDraft?.allEmails || pickedDraft?.emails || []).map((e) => (
              <label
                key={e}
                className="flex cursor-pointer items-center gap-2 rounded-xl border border-stroke px-3 py-2 text-sm dark:border-dark-3"
              >
                <input
                  type="radio"
                  name="emailChoice"
                  checked={emailChoice === e}
                  onChange={() => setEmailChoice(e)}
                />
                <span className="font-mono">{e}</span>
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
