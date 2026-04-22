"use client";

import { useState } from "react";
import type {
  Notice,
  UserAdmin,
  UserAulaAssigned,
  AulaSearchItem,
} from "../types";
import { Modal } from "@/components/ui/Modal";
import {
  apiAttachAula,
  apiDetachAula,
  apiListAssignedAule,
  apiSearchAule,
} from "../api";
import { AULE_TYPES as PUBLIC_AULE_TYPES } from "@/config/aule.types.public";

const AULA_TYPES: { slug: string; label: string }[] = PUBLIC_AULE_TYPES.map(
  (t) => ({ slug: t.slug, label: t.label }),
);

export default function UserAulaManager({
  user,
  onNotice,
}: {
  user: UserAdmin;
  onNotice: (n: Notice) => void;
}) {
  const [open, setOpen] = useState(false);

  const [assigned, setAssigned] = useState<UserAulaAssigned[]>([]);
  const [loadingAssigned, setLoadingAssigned] = useState(false);

  const [selectedType, setSelectedType] = useState("agenti");
  const [search, setSearch] = useState("");
  const [searchResults, setSearchResults] = useState<AulaSearchItem[]>([]);
  const [searching, setSearching] = useState(false);

  const [savingId, setSavingId] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);

  async function loadAssigned() {
    try {
      setLoadingAssigned(true);
      const items = await apiListAssignedAule(user.id);
      setAssigned(items);
    } catch (e: any) {
      onNotice({ type: "error", text: e?.message || "Errore recupero aule collegate" });
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
      onNotice({ type: "error", text: "Seleziona un tipo di aula" });
      return;
    }
    setSearching(true);
    try {
      const items = await apiSearchAule({
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

  async function handleAttachAula(aulaId: string) {
    if (!selectedType) return;
    setSavingId(aulaId);
    try {
      await apiAttachAula({
        userId: user.id,
        aulaType: selectedType,
        aulaId,
      });
      onNotice({ type: "success", text: "Accesso all'aula concesso" });
      await loadAssigned();
    } catch (e: any) {
      onNotice({ type: "error", text: e?.message || "Errore associazione aula" });
    } finally {
      setSavingId(null);
    }
  }

  async function handleDetachAula(item: UserAulaAssigned) {
    setRemovingId(item.aulaId);
    try {
      await apiDetachAula({
        userId: user.id,
        aulaType: item.type,
        aulaId: item.aulaId,
      });

      setAssigned((prev) =>
        prev.filter((x) => !(x.type === item.type && x.aulaId === item.aulaId)),
      );
      onNotice({ type: "success", text: "Accesso all'aula revocato" });
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
        Aule
      </button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={`Accesso aule per ${user.name || user.email}`}
        subtitle={
          <span>
            Ruolo: <span className="font-mono">{user.role}</span> · ID:{" "}
            <span className="break-all font-mono text-[10px]">{user.id}</span>
          </span>
        }
        maxWidthClassName="max-w-5xl"
      >
        <div className="mb-4 grid gap-3 md:grid-cols-[220px,1fr,auto] md:items-end">
          <div>
            <label className="text-[11px] font-medium text-dark dark:text-white">Tipo aula</label>
            <select
              className="mt-1 w-full rounded-md border border-stroke bg-white px-2 py-1.5 text-xs text-dark outline-none focus:border-primary dark:border-dark-3 dark:bg-dark-2 dark:text-dark-6"
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
            >
              {AULA_TYPES.map((t) => (
                <option key={t.slug} value={t.slug} className="bg-white text-dark dark:bg-dark-2 dark:text-dark-6">
                  {t.label} ({t.slug})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-[11px] font-medium text-dark dark:text-white">Cerca aula</label>
            <input
              className="mt-1 w-full rounded-md border border-stroke bg-transparent px-2 py-1.5 text-xs text-dark outline-none focus:border-primary dark:border-dark-3 dark:text-white"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Nome aula, indirizzo, email agente..."
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
                    (a) => a.type === selectedType && a.aulaId === r.id,
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
                        onClick={() => handleAttachAula(r.id)}
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

          <div className="rounded-lg border border-stroke p-2 text-xs dark:border-dark-3">
            <div className="mb-1 flex items-center justify-between">
              <span className="text-[11px] font-semibold text-dark/80 dark:text-white/80">
                Aule collegate
              </span>
              {loadingAssigned && (
                <span className="text-[11px] text-dark/60 dark:text-white/60">
                  Caricamento...
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
                Nessuna aula collegata per questo utente.
              </div>
            ) : (
              <div className="max-h-80 space-y-1 overflow-y-auto pr-1">
                {assigned.map((a) => (
                  <div
                    key={`${a.type}-${a.aulaId}`}
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
                      disabled={removingId === a.aulaId}
                      onClick={() => handleDetachAula(a)}
                      className="whitespace-nowrap rounded-md bg-red-500 px-2 py-0.5 text-[11px] font-medium text-white hover:opacity-90 disabled:opacity-40"
                    >
                      {removingId === a.aulaId ? "..." : "Revoca"}
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
