"use client";

import { useState } from "react";
import type { Notice, UserAdmin, UserAnagraficaAssigned, AnagraficaSearchItem } from "../types";
import { Modal } from "@/components/ui/Modal";
import {
  apiAttachAnagrafica,
  apiDetachAnagrafica,
  apiListAssignedAnagrafiche,
  apiSearchAnagrafiche,
} from "../api";
import { ANAGRAFICA_TYPES as PUBLIC_ANAGRAFICA_TYPES } from "@/config/anagrafiche.types.public";

const ANAGRAFICA_TYPES: { slug: string; label: string }[] =
  PUBLIC_ANAGRAFICA_TYPES.map((t) => ({ slug: t.slug, label: t.label }));

export default function UserAnagraficaManager({
                                                user,
                                                onNotice,
                                              }: {
  user: UserAdmin;
  onNotice: (n: Notice) => void;
}) {
  const [open, setOpen] = useState(false);

  const [assigned, setAssigned] = useState<UserAnagraficaAssigned[]>([]);
  const [loadingAssigned, setLoadingAssigned] = useState(false);

  const [selectedType, setSelectedType] = useState(ANAGRAFICA_TYPES[0]?.slug ?? "");
  const [search, setSearch] = useState("");
  const [searchResults, setSearchResults] = useState<AnagraficaSearchItem[]>([]);
  const [searching, setSearching] = useState(false);

  const [savingId, setSavingId] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);

  async function loadAssigned() {
    try {
      setLoadingAssigned(true);
      const items = await apiListAssignedAnagrafiche(user.id);
      setAssigned(items);
    } catch (e: any) {
      onNotice({ type: "error", text: e?.message || "Errore recupero anagrafiche collegate" });
    } finally {
      setLoadingAssigned(false);
    }
  }

  async function handleOpen() {
    setOpen(true);
    await loadAssigned();
    setSearchResults([]);
    setSearch("");
  }

  async function handleSearch() {
    if (!selectedType) {
      onNotice({ type: "error", text: "Seleziona un tipo di anagrafica" });
      return;
    }
    setSearching(true);
    try {
      const items = await apiSearchAnagrafiche({
        typeSlug: selectedType,
        query: search,
        page: 1,
        pageSize: 20,
      });
      setSearchResults(items);
    } catch (e: any) {
      onNotice({ type: "error", text: e?.message || "Errore durante la ricerca" });
    } finally {
      setSearching(false);
    }
  }

  async function handleAttachAnagrafica(anagraficaId: string) {
    if (!selectedType) return;
    setSavingId(anagraficaId);
    try {
      await apiAttachAnagrafica({
        userId: user.id,
        anagraficaType: selectedType,
        anagraficaId,
      });
      onNotice({ type: "success", text: "Accesso all'anagrafica concesso" });
      await loadAssigned();
    } catch (e: any) {
      onNotice({ type: "error", text: e?.message || "Errore associazione anagrafica" });
    } finally {
      setSavingId(null);
    }
  }

  async function handleDetachAnagrafica(item: UserAnagraficaAssigned) {
    setRemovingId(item.anagraficaId);
    try {
      await apiDetachAnagrafica({
        userId: user.id,
        anagraficaType: item.type,
        anagraficaId: item.anagraficaId,
      });

      setAssigned((prev) =>
        prev.filter((x) => !(x.type === item.type && x.anagraficaId === item.anagraficaId)),
      );
      onNotice({ type: "success", text: "Accesso all'anagrafica revocato" });
    } catch (e: any) {
      onNotice({ type: "error", text: e?.message || "Errore durante la revoca" });
    } finally {
      setRemovingId(null);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        className="rounded-md border border-stroke px-3 py-1.5 text-xs font-medium text-dark hover:bg-gray-2 dark:border-dark-3 dark:text-white dark:hover:bg-dark-2"
      >
        Anagrafiche
      </button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={`Accesso anagrafiche per ${user.name || user.email}`}
        subtitle={
          <span>
            Ruolo: <span className="font-mono">{user.role}</span> · ID:{" "}
            <span className="break-all font-mono text-[10px]">{user.id}</span>
          </span>
        }
        maxWidthClassName="max-w-5xl"
      >
        {/* filtro + ricerca */}
        <div className="mb-4 grid gap-3 md:grid-cols-[220px,1fr,auto] md:items-end">
          <div>
            <label className="text-[11px] font-medium text-dark dark:text-white">Tipo anagrafica</label>
            <select
              className="mt-1 w-full rounded-md border border-stroke bg-white px-2 py-1.5 text-xs text-dark outline-none focus:border-primary dark:border-dark-3 dark:bg-dark-2 dark:text-dark-6"
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
            >
              {ANAGRAFICA_TYPES.map((t) => (
                <option key={t.slug} value={t.slug} className="bg-white text-dark dark:bg-dark-2 dark:text-dark-6">
                  {t.label} ({t.slug})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-[11px] font-medium text-dark dark:text-white">Cerca anagrafica</label>
            <input
              className="mt-1 w-full rounded-md border border-stroke bg-transparent px-2 py-1.5 text-xs text-dark outline-none focus:border-primary dark:border-dark-3 dark:text-white"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Nome, codice, ecc…"
            />
          </div>

          <div className="flex justify-end">
            <button
              type="button"
              onClick={handleSearch}
              disabled={searching}
              className="mt-5 inline-flex items-center rounded-md bg-primary px-4 py-1.5 text-xs font-medium text-white hover:opacity-90 disabled:opacity-50 dark:bg-blue-light"
            >
              {searching ? "..." : "Cerca"}
            </button>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {/* Risultati ricerca */}
          <div className="rounded-lg border border-stroke p-2 text-xs dark:border-dark-3">
            <div className="mb-1 flex items-center justify-between">
              <span className="text-[11px] font-semibold text-dark/80 dark:text-white/80">
                Risultati ricerca
              </span>
              {searchResults.length > 0 && (
                <span className="text-[11px] text-dark/60 dark:text-white/60">
                  {searchResults.length} risultati
                </span>
              )}
            </div>

            {searchResults.length === 0 ? (
              <div className="py-4 text-[11px] text-dark/60 dark:text-white/60">
                Nessun risultato. Usa i filtri e premi &quot;Cerca&quot;.
              </div>
            ) : (
              <div className="max-h-80 space-y-1 overflow-y-auto pr-1">
                {searchResults.map((r) => {
                  const alreadyAssigned = assigned.some(
                    (a) => a.type === selectedType && a.anagraficaId === r.id,
                  );
                  return (
                    <div
                      key={r.id}
                      className="flex items-center justify-between gap-2 rounded-md px-2 py-1 hover:bg-gray-2/60 dark:hover:bg-dark-2/60"
                    >
                      <div className="min-w-0">
                        <div className="truncate font-medium text-dark dark:text-white">
                          {r.displayName}
                        </div>
                        {r.subtitle && (
                          <div className="truncate text-[11px] text-dark/70 dark:text-white/70">
                            {r.subtitle}
                          </div>
                        )}
                      </div>
                      <button
                        type="button"
                        disabled={alreadyAssigned || savingId === r.id}
                        onClick={() => handleAttachAnagrafica(r.id)}
                        className="whitespace-nowrap rounded-md bg-emerald-600 px-2 py-0.5 text-[11px] font-medium text-white hover:opacity-90 disabled:opacity-40"
                      >
                        {alreadyAssigned ? "Già collegata" : savingId === r.id ? "..." : "Concedi"}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Anagrafiche collegate */}
          <div className="rounded-lg border border-stroke p-2 text-xs dark:border-dark-3">
            <div className="mb-1 flex items-center justify-between">
              <span className="text-[11px] font-semibold text-dark/80 dark:text-white/80">
                Anagrafiche collegate
              </span>
              {loadingAssigned && (
                <span className="text-[11px] text-dark/60 dark:text-white/60">
                  Caricamento…
                </span>
              )}
            </div>

            {loadingAssigned ? (
              <div className="space-y-1 py-2">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="h-7 animate-pulse rounded bg-gray-2 dark:bg-dark-2" />
                ))}
              </div>
            ) : assigned.length === 0 ? (
              <div className="py-4 text-[11px] text-dark/60 dark:text-white/60">
                Nessuna anagrafica collegata per questo utente.
              </div>
            ) : (
              <div className="max-h-80 space-y-1 overflow-y-auto pr-1">
                {assigned.map((a) => (
                  <div
                    key={`${a.type}-${a.anagraficaId}`}
                    className="flex items-center justify-between gap-2 rounded-md border border-stroke px-2 py-1 dark:border-dark-3"
                  >
                    <div className="min-w-0">
                      <div className="truncate font-medium text-dark dark:text-white">
                        {a.displayName}
                      </div>
                      <div className="truncate text-[11px] text-dark/70 dark:text-white/70">
                        <span className="font-mono">{a.type}</span>
                        {a.subtitle ? ` · ${a.subtitle}` : ""}
                      </div>
                    </div>
                    <button
                      type="button"
                      disabled={removingId === a.anagraficaId}
                      onClick={() => handleDetachAnagrafica(a)}
                      className="whitespace-nowrap rounded-md bg-red-500 px-2 py-0.5 text-[11px] font-medium text-white hover:opacity-90 disabled:opacity-40"
                    >
                      {removingId === a.anagraficaId ? "..." : "Revoca"}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </Modal>
    </>
  );
}
