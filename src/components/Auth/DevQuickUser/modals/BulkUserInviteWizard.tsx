"use client";

import { useEffect, useMemo, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import {
  apiCreateBulkInvites,
  apiPreviewBulkInvites,
  apiSearchAnagrafiche,
  apiSearchAule,
} from "../api";
import type {
  AnagraficaSearchItem,
  AulaSearchItem,
  BulkInviteCreateResult,
  BulkInvitePreviewResult,
  BulkInviteSourceKind,
  Notice,
} from "../types";
import { ANAGRAFICA_TYPES } from "@/config/anagrafiche.types.public";
import { AULE_TYPES } from "@/config/aule.types.public";
import { FIELD_CATALOG } from "@/config/anagrafiche.fields.catalog";
import { AULA_FIELD_CATALOG } from "@/config/aule.fields.catalog";
import RoleSelect from "../ui/RoleSelect";
import { ROLES, type AppRole } from "@/types/roles";

type SearchItem = {
  id: string;
  displayName: string;
  subtitle: string | null;
};

function getFieldOptions(sourceKind: BulkInviteSourceKind, sourceType: string) {
  if (sourceKind === "anagrafica") {
    const typeDef = ANAGRAFICA_TYPES.find((item) => item.slug === sourceType);
    const fields = (typeDef?.fields || []).map((key) => ({ key, ...FIELD_CATALOG[key] }));
    return {
      emailFields: fields.filter((field) => ["email", "text"].includes(field.type)),
      nameFields: fields.filter((field) => ["text", "email", "tel"].includes(field.type)),
    };
  }

  const typeDef = AULE_TYPES.find((item) => item.slug === sourceType);
  const fields = (typeDef?.fields || []).map((key) => ({ key, ...AULA_FIELD_CATALOG[key] }));
  return {
    emailFields: fields.filter((field) => field.type === "text"),
    nameFields: fields.filter((field) => field.type === "text"),
  };
}

function statusLabel(status: string) {
  switch (status) {
    case "ready_create":
      return "Nuovo invito";
    case "ready_regenerate":
      return "Rigenera invito";
    case "missing_email":
      return "Email mancante";
    case "invalid_email":
      return "Email non valida";
    case "duplicate_email":
      return "Email duplicata";
    case "active_user_conflict":
      return "Utente attivo già presente";
    default:
      return status;
  }
}

export default function BulkUserInviteWizard({
  onNotice,
  onAfterBulk,
}: {
  onNotice: (n: Notice) => void;
  onAfterBulk?: () => void;
}) {
  const defaultRole = ROLES.includes("Cliente" as AppRole) ? ("Cliente" as AppRole) : ROLES[0];
  const [open, setOpen] = useState(false);
  const [sourceKind, setSourceKind] = useState<BulkInviteSourceKind>("anagrafica");
  const [sourceType, setSourceType] = useState(ANAGRAFICA_TYPES[0]?.slug ?? "");
  const [search, setSearch] = useState("");
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<SearchItem[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [emailFieldKey, setEmailFieldKey] = useState("");
  const [nameFieldKey, setNameFieldKey] = useState("");
  const [role, setRole] = useState<AppRole>(defaultRole);
  const [expiresInHours, setExpiresInHours] = useState(48);
  const [sendEmail, setSendEmail] = useState(true);
  const [throttleMs, setThrottleMs] = useState(1500);
  const [preview, setPreview] = useState<BulkInvitePreviewResult | null>(null);
  const [bulkResult, setBulkResult] = useState<BulkInviteCreateResult | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [creating, setCreating] = useState(false);

  const sourceTypes = sourceKind === "anagrafica" ? ANAGRAFICA_TYPES : AULE_TYPES;

  const fieldOptions = useMemo(
    () => getFieldOptions(sourceKind, sourceType),
    [sourceKind, sourceType],
  );

  useEffect(() => {
    const nextType =
      (sourceKind === "anagrafica" ? ANAGRAFICA_TYPES[0]?.slug : AULE_TYPES[0]?.slug) ?? "";
    setSourceType(nextType);
    setSearch("");
    setResults([]);
    setSelectedIds([]);
    setPreview(null);
    setBulkResult(null);
  }, [sourceKind]);

  useEffect(() => {
    const nextEmail = fieldOptions.emailFields[0]?.key ?? "";
    const nextName =
      fieldOptions.nameFields.find((field) => /nome|ragione/i.test(field.key))?.key ||
      fieldOptions.nameFields[0]?.key ||
      "";
    setEmailFieldKey(nextEmail);
    setNameFieldKey(nextName);
    setPreview(null);
    setBulkResult(null);
  }, [fieldOptions.emailFields, fieldOptions.nameFields]);

  async function handleOpen() {
    setOpen(true);
    setPreview(null);
    setBulkResult(null);
    await handleSearch("");
  }

  async function handleSearch(nextSearch = search) {
    if (!sourceType) return;

    setSearching(true);
    try {
      const items =
        sourceKind === "anagrafica"
          ? await apiSearchAnagrafiche({
              typeSlug: sourceType,
              query: nextSearch,
              page: 1,
              pageSize: 50,
            })
          : await apiSearchAule({
              typeSlug: sourceType,
              query: nextSearch,
              page: 1,
              pageSize: 50,
            });
      setResults((items as (AnagraficaSearchItem | AulaSearchItem)[]).map((item) => ({
        id: item.id,
        displayName: item.displayName,
        subtitle: item.subtitle,
      })));
    } catch (e: any) {
      onNotice({ type: "error", text: e?.message || "Errore ricerca bulk" });
    } finally {
      setSearching(false);
    }
  }

  function toggleSelection(id: string) {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]));
    setPreview(null);
    setBulkResult(null);
  }

  async function handlePreview() {
    if (!sourceType || !emailFieldKey || !nameFieldKey || !selectedIds.length) {
      onNotice({ type: "error", text: "Completa tipo, campi e selezione record" });
      return;
    }

    setPreviewing(true);
    setBulkResult(null);
    try {
      const result = await apiPreviewBulkInvites({
        sourceKind,
        sourceType,
        sourceIds: selectedIds,
        emailFieldKey,
        nameFieldKey,
      });
      setPreview(result);
      onNotice({ type: "info", text: "Preview bulk aggiornata" });
    } catch (e: any) {
      onNotice({ type: "error", text: e?.message || "Errore preview bulk" });
    } finally {
      setPreviewing(false);
    }
  }

  async function handleCreate() {
    if (!preview) {
      await handlePreview();
      return;
    }

    setCreating(true);
    try {
      const result = await apiCreateBulkInvites({
        sourceKind,
        sourceType,
        sourceIds: selectedIds,
        emailFieldKey,
        nameFieldKey,
        role,
        expiresInHours,
        sendEmail,
        throttleMs,
      });
      setBulkResult(result);
      onNotice({
        type: "success",
        text: `Bulk completato: ${result.summary.created + result.summary.regenerated} inviti gestiti.`,
      });
      onAfterBulk?.();
    } catch (e: any) {
      onNotice({ type: "error", text: e?.message || "Errore creazione bulk" });
    } finally {
      setCreating(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        className="inline-flex items-center justify-center rounded-md border border-stroke px-4 py-2 text-sm font-medium text-dark hover:bg-gray-2 dark:border-dark-3 dark:text-white dark:hover:bg-dark-2"
      >
        Wizard bulk
      </button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Bulk utenti da anagrafiche o aule"
        subtitle="Seleziona i record sorgente, scegli i campi email/nome e poi crea o rigenera gli inviti in blocco."
        maxWidthClassName="max-w-6xl"
      >
        <div className="space-y-4">
          <div className="grid gap-3 lg:grid-cols-4">
            <label className="text-sm text-dark dark:text-white">
              Sorgente
              <select
                className="mt-1 w-full rounded-lg border border-stroke bg-transparent px-3 py-2 text-sm text-dark outline-none focus:border-primary dark:border-dark-3 dark:text-white"
                value={sourceKind}
                onChange={(e) => setSourceKind(e.target.value as BulkInviteSourceKind)}
              >
                <option value="anagrafica">Anagrafica</option>
                <option value="aula">Aula</option>
              </select>
            </label>

            <label className="text-sm text-dark dark:text-white">
              Tipo
              <select
                className="mt-1 w-full rounded-lg border border-stroke bg-transparent px-3 py-2 text-sm text-dark outline-none focus:border-primary dark:border-dark-3 dark:text-white"
                value={sourceType}
                onChange={(e) => {
                  setSourceType(e.target.value);
                  setSelectedIds([]);
                  setPreview(null);
                  setBulkResult(null);
                }}
              >
                {sourceTypes.map((item) => (
                  <option key={item.slug} value={item.slug}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="text-sm text-dark dark:text-white">
              Campo email
              <select
                className="mt-1 w-full rounded-lg border border-stroke bg-transparent px-3 py-2 text-sm text-dark outline-none focus:border-primary dark:border-dark-3 dark:text-white"
                value={emailFieldKey}
                onChange={(e) => setEmailFieldKey(e.target.value)}
              >
                {fieldOptions.emailFields.map((field) => (
                  <option key={field.key} value={field.key}>
                    {field.label} ({field.key})
                  </option>
                ))}
              </select>
            </label>

            <label className="text-sm text-dark dark:text-white">
              Campo nome utente
              <select
                className="mt-1 w-full rounded-lg border border-stroke bg-transparent px-3 py-2 text-sm text-dark outline-none focus:border-primary dark:border-dark-3 dark:text-white"
                value={nameFieldKey}
                onChange={(e) => setNameFieldKey(e.target.value)}
              >
                {fieldOptions.nameFields.map((field) => (
                  <option key={field.key} value={field.key}>
                    {field.label} ({field.key})
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="grid gap-3 lg:grid-cols-[1fr,auto]">
            <label className="text-sm text-dark dark:text-white">
              Cerca record
              <input
                className="mt-1 w-full rounded-lg border border-stroke bg-transparent px-3 py-2 text-sm text-dark outline-none focus:border-primary dark:border-dark-3 dark:text-white"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={sourceKind === "anagrafica" ? "Ragione sociale, nome, codice..." : "Nome aula, email, telefono..."}
              />
            </label>

            <div className="flex items-end">
              <button
                type="button"
                onClick={() => handleSearch()}
                disabled={searching}
                className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50 dark:bg-blue-light"
              >
                {searching ? "..." : "Cerca"}
              </button>
            </div>
          </div>

          <div className="rounded-lg border border-stroke p-3 dark:border-dark-3">
            <div className="mb-2 flex items-center justify-between">
              <div className="text-sm font-medium text-dark dark:text-white">
                Selezione record
              </div>
              <div className="text-xs text-dark/60 dark:text-white/60">
                {selectedIds.length} selezionati
              </div>
            </div>

            <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
              {results.map((item) => {
                const checked = selectedIds.includes(item.id);
                return (
                  <label
                    key={item.id}
                    className="flex cursor-pointer items-start gap-3 rounded-md border border-stroke px-3 py-2 hover:bg-gray-2/60 dark:border-dark-3 dark:hover:bg-dark-2/60"
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleSelection(item.id)}
                      className="mt-1"
                    />
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium text-dark dark:text-white">
                        {item.displayName}
                      </div>
                      {item.subtitle ? (
                        <div className="truncate text-xs text-dark/70 dark:text-white/70">
                          {item.subtitle}
                        </div>
                      ) : null}
                      <div className="truncate text-[11px] text-dark/50 dark:text-white/50">
                        {item.id}
                      </div>
                    </div>
                  </label>
                );
              })}

              {!results.length ? (
                <div className="py-6 text-center text-xs text-dark/60 dark:text-white/60">
                  Nessun record trovato. Prova una ricerca oppure cambia tipo.
                </div>
              ) : null}
            </div>
          </div>

          <div className="grid gap-3 lg:grid-cols-4">
            <RoleSelect label="Ruolo" value={role} onChange={setRole} />

            <label className="text-sm text-dark dark:text-white">
              Scadenza invito (ore)
              <input
                type="number"
                min={1}
                value={expiresInHours}
                onChange={(e) => setExpiresInHours(Number(e.target.value || 48))}
                className="mt-1 w-full rounded-lg border border-stroke bg-transparent px-3 py-2 text-sm text-dark outline-none focus:border-primary dark:border-dark-3 dark:text-white"
              />
            </label>

            <label className="text-sm text-dark dark:text-white">
              Pausa tra email (ms)
              <input
                type="number"
                min={0}
                value={throttleMs}
                onChange={(e) => setThrottleMs(Number(e.target.value || 0))}
                disabled={!sendEmail}
                className="mt-1 w-full rounded-lg border border-stroke bg-transparent px-3 py-2 text-sm text-dark outline-none focus:border-primary disabled:opacity-50 dark:border-dark-3 dark:text-white"
              />
            </label>

            <label className="flex items-center gap-2 pt-8 text-sm text-dark dark:text-white">
              <input
                type="checkbox"
                checked={sendEmail}
                onChange={(e) => setSendEmail(e.target.checked)}
              />
              Invia email via Resend
            </label>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handlePreview}
              disabled={previewing || creating || !selectedIds.length}
              className="rounded-md border border-stroke px-4 py-2 text-sm font-medium text-dark hover:bg-gray-2 disabled:opacity-50 dark:border-dark-3 dark:text-white dark:hover:bg-dark-2"
            >
              {previewing ? "Preview..." : "Genera preview"}
            </button>
            <button
              type="button"
              onClick={handleCreate}
              disabled={creating || previewing || !selectedIds.length}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50 dark:bg-blue-light"
            >
              {creating
                ? "Creazione..."
                : sendEmail
                  ? "Crea bulk utenze e invia mail"
                  : "Crea bulk utenze e genera link"}
            </button>
          </div>

          {preview ? (
            <div className="rounded-lg border border-stroke p-3 dark:border-dark-3">
              <div className="mb-2 text-sm font-medium text-dark dark:text-white">
                Preview bulk
              </div>
              <div className="mb-3 flex flex-wrap gap-2 text-xs text-dark/70 dark:text-white/70">
                <span>Totale: {preview.summary.total}</span>
                <span>Nuovi: {preview.summary.readyCreate}</span>
                <span>Rigenera: {preview.summary.readyRegenerate}</span>
                <span>Skip email mancanti: {preview.summary.missingEmail}</span>
                <span>Skip invalidi: {preview.summary.invalidEmail}</span>
                <span>Skip duplicati: {preview.summary.duplicateEmail}</span>
                <span>Conflitti attivi: {preview.summary.activeUserConflict}</span>
              </div>

              <div className="max-h-72 overflow-y-auto">
                <table className="w-full min-w-[720px] text-left text-xs">
                  <thead className="text-dark/70 dark:text-white/70">
                    <tr>
                      <th className="pb-2">Record</th>
                      <th className="pb-2">Email</th>
                      <th className="pb-2">Nome utente</th>
                      <th className="pb-2">Esito</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.items.map((item) => (
                      <tr key={item.sourceId} className="border-t border-stroke dark:border-dark-3">
                        <td className="py-2 pr-3">
                          <div className="font-medium text-dark dark:text-white">{item.displayName}</div>
                          {item.subtitle ? (
                            <div className="text-[11px] text-dark/60 dark:text-white/60">{item.subtitle}</div>
                          ) : null}
                        </td>
                        <td className="py-2 pr-3">
                          <span className="font-mono">{item.email || "-"}</span>
                        </td>
                        <td className="py-2 pr-3">{item.username || "-"}</td>
                        <td className="py-2">
                          <div className="font-medium text-dark dark:text-white">
                            {statusLabel(item.status)}
                          </div>
                          {item.reason ? (
                            <div className="text-[11px] text-dark/60 dark:text-white/60">{item.reason}</div>
                          ) : null}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}

          {bulkResult ? (
            <div className="rounded-lg border border-stroke p-3 dark:border-dark-3">
              <div className="mb-2 text-sm font-medium text-dark dark:text-white">
                Report esecuzione
              </div>
              <div className="mb-3 flex flex-wrap gap-2 text-xs text-dark/70 dark:text-white/70">
                <span>Creati: {bulkResult.summary.created}</span>
                <span>Rigenerati: {bulkResult.summary.regenerated}</span>
                <span>Saltati: {bulkResult.summary.skipped}</span>
                <span>Falliti: {bulkResult.summary.failed}</span>
              </div>

              <div className="max-h-72 overflow-y-auto">
                <table className="w-full min-w-[760px] text-left text-xs">
                  <thead className="text-dark/70 dark:text-white/70">
                    <tr>
                      <th className="pb-2">Record</th>
                      <th className="pb-2">Outcome</th>
                      <th className="pb-2">Scadenza</th>
                      <th className="pb-2">Permesso</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bulkResult.items.map((item) => (
                      <tr key={item.sourceId} className="border-t border-stroke dark:border-dark-3">
                        <td className="py-2 pr-3">
                          <div className="font-medium text-dark dark:text-white">{item.displayName}</div>
                          <div className="text-[11px] text-dark/60 dark:text-white/60">
                            {item.email || "-"}
                          </div>
                          {item.error ? (
                            <div className="text-[11px] text-rose-600 dark:text-rose-300">{item.error}</div>
                          ) : null}
                        </td>
                        <td className="py-2 pr-3 capitalize">{item.outcome}</td>
                        <td className="py-2 pr-3">
                          {item.expiresAt ? new Date(item.expiresAt).toLocaleString() : "-"}
                        </td>
                        <td className="py-2">{item.assignedPermission ? "Assegnato" : "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}
        </div>
      </Modal>
    </>
  );
}
