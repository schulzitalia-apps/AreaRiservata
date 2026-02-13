"use client";

import { useEffect, useMemo, useState } from "react";
import { cn } from "@/server-utils/lib/utils";

type Notice = { type: "success" | "error" | "info"; text: string } | null;

function InlineAlert({
                       notice,
                       onClose,
                     }: {
  notice: Notice;
  onClose: () => void;
}) {
  if (!notice) return null;

  const tone =
    notice.type === "success"
      ? "bg-green-50 border-green-500 text-green-800 dark:bg-green-900/30 dark:border-green-400 dark:text-green-100"
      : notice.type === "error"
        ? "bg-red-50 border-red-500 text-red-800 dark:bg-red-900/30 dark:border-red-400 dark:text-red-100"
        : "bg-blue-50 border-blue-500 text-blue-800 dark:bg-blue-900/30 dark:border-blue-400 dark:text-blue-100";

  const icon = notice.type === "success" ? "✔️" : notice.type === "error" ? "⚠️" : "ℹ️";

  return (
    <div className={`mb-4 flex items-start gap-2 rounded-lg border px-3 py-2 ${tone}`}>
      <span className="mt-0.5">{icon}</span>
      <p className="text-sm leading-5">{notice.text}</p>
      <button
        onClick={onClose}
        className="ml-auto rounded px-1.5 text-xs hover:opacity-80"
        aria-label="Chiudi notifica"
      >
        ✕
      </button>
    </div>
  );
}

type ActionItem = {
  id: string;
  scope: "ANAGRAFICA" | "AULA";
  label: string;
  description: string;
  anagraficaType: string | null;
  aulaType: string | null;
  field: string | null;
  trigger: "ON_SAVE" | "ON_CHANGE" | "ON_FIRST_SET";
  eventType: string;
  timeKind: "point" | "deadline" | "interval";
  visibility: string;
  timeSource: "field" | "now";
  rule: {
    enabled: boolean;
    sendMode: "IMMEDIATO" | "ALLA_DATA_EVENTO";
    subjectTemplate: string;
    htmlTemplate: string;
    updatedAt: string | null;
  };
};

export default function ActionMailRulesAdminPanel() {
  const [items, setItems] = useState<ActionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<Notice>(null);
  const [savingId, setSavingId] = useState<string | null>(null);

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 3500);
    return () => clearTimeout(t);
  }, [notice]);

  async function loadAll() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/actions-mail/actions", {
        credentials: "include",
      });
      const json = await res.json();
      if (!res.ok || !json?.ok) {
        throw new Error(json?.message || "Errore caricamento azioni");
      }
      setItems(json.items as ActionItem[]);
    } catch (e: any) {
      setNotice({ type: "error", text: e?.message || "Errore inatteso" });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
  }, []);

  const grouped = useMemo(() => {
    const a = items.filter((x) => x.scope === "ANAGRAFICA");
    const b = items.filter((x) => x.scope === "AULA");
    return { anagrafiche: a, aule: b };
  }, [items]);

  function updateLocal(id: string, patch: Partial<ActionItem["rule"]>) {
    setItems((prev) =>
      prev.map((x) => (x.id === id ? { ...x, rule: { ...x.rule, ...patch } } : x))
    );
  }

  async function saveOne(item: ActionItem) {
    if (savingId) return;
    setSavingId(item.id);
    try {
      const res = await fetch(`/api/admin/actions-mail/rules/${encodeURIComponent(item.id)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          scope: item.scope,
          enabled: item.rule.enabled,
          sendMode: item.rule.sendMode,
          subjectTemplate: item.rule.subjectTemplate,
          htmlTemplate: item.rule.htmlTemplate,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json?.ok) {
        throw new Error(json?.message || "Errore salvataggio regola");
      }

      const updated = json.item;
      updateLocal(item.id, {
        enabled: !!updated.enabled,
        sendMode: updated.sendMode,
        subjectTemplate: updated.subjectTemplate ?? "",
        htmlTemplate: updated.htmlTemplate ?? "",
      });

      setNotice({ type: "success", text: "Regola salvata" });
    } catch (e: any) {
      setNotice({ type: "error", text: e?.message || "Errore durante il salvataggio" });
    } finally {
      setSavingId(null);
    }
  }

  const renderCard = (x: ActionItem) => {
    const isBusy = savingId === x.id;

    return (
      <div
        key={x.id}
        className="rounded-xl border border-stroke bg-white p-4 shadow-sm dark:border-dark-3 dark:bg-gray-dark"
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-base font-semibold text-dark dark:text-white">
                {x.label}
              </h3>

              <span className="rounded-full bg-gray-2 px-2 py-0.5 text-xs font-semibold text-dark/80 dark:bg-dark-2 dark:text-white/80">
                {x.scope}
              </span>

              <span className="rounded-full bg-gray-2 px-2 py-0.5 text-xs text-dark/70 dark:bg-dark-2 dark:text-white/70">
                trigger: {x.trigger}
              </span>

              <span className="rounded-full bg-gray-2 px-2 py-0.5 text-xs text-dark/70 dark:bg-dark-2 dark:text-white/70">
                timeKind: {x.timeKind}
              </span>

              <span className="rounded-full bg-gray-2 px-2 py-0.5 text-xs text-dark/70 dark:bg-dark-2 dark:text-white/70">
                visibility: {x.visibility}
              </span>

              <span className="rounded-full bg-gray-2 px-2 py-0.5 text-xs text-dark/70 dark:bg-dark-2 dark:text-white/70">
                timeSource: {x.timeSource}
              </span>
            </div>

            {x.description ? (
              <p className="mt-1 text-sm text-dark/70 dark:text-white/70">
                {x.description}
              </p>
            ) : null}

            <div className="mt-2 grid gap-1 text-xs text-dark/70 dark:text-white/70 sm:grid-cols-2">
              <div>
                <span className="font-semibold">Tipo:</span>{" "}
                {x.scope === "ANAGRAFICA" ? x.anagraficaType : x.aulaType}
              </div>
              <div>
                <span className="font-semibold">Campo:</span>{" "}
                {x.field ?? "—"}
              </div>
              <div className="sm:col-span-2">
                <span className="font-semibold">Evento:</span>{" "}
                {x.eventType}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <label className="flex items-center gap-2 text-sm text-dark dark:text-white">
              <input
                type="checkbox"
                checked={x.rule.enabled}
                onChange={(e) => updateLocal(x.id, { enabled: e.target.checked })}
                className="h-4 w-4"
              />
              Abilitata
            </label>
          </div>
        </div>

        <div className="mt-4 grid gap-3">
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <label className="text-xs font-semibold text-dark/80 dark:text-white/80">
                Modalità invio
              </label>
              <select
                value={x.rule.sendMode}
                onChange={(e) =>
                  updateLocal(x.id, { sendMode: e.target.value as any })
                }
                className="mt-1 w-full rounded-lg border border-stroke bg-transparent px-3 py-2 text-sm text-dark outline-none focus:border-primary dark:border-dark-3 dark:text-white"
              >
                <option value="IMMEDIATO">Invia subito (quando si crea l’evento)</option>
                <option value="ALLA_DATA_EVENTO">Invia alla data evento (routine futura)</option>
              </select>
              <p className="mt-1 text-[11px] text-dark/60 dark:text-white/60">
                Nota: se l’azione è “interval”, l’evento può avere intervallo temporale.
              </p>
            </div>

            <div>
              <label className="text-xs font-semibold text-dark/80 dark:text-white/80">
                Oggetto email (template)
              </label>
              <input
                value={x.rule.subjectTemplate}
                onChange={(e) =>
                  updateLocal(x.id, { subjectTemplate: e.target.value })
                }
                placeholder="Es: Avviso: {{anagrafica.numeroOrdine}}"
                className="mt-1 w-full rounded-lg border border-stroke bg-transparent px-3 py-2 text-sm text-dark outline-none focus:border-primary dark:border-dark-3 dark:text-white"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-dark/80 dark:text-white/80">
              Corpo email (HTML template)
            </label>
            <textarea
              value={x.rule.htmlTemplate}
              onChange={(e) =>
                updateLocal(x.id, { htmlTemplate: e.target.value })
              }
              rows={6}
              placeholder={`Esempio:\n<p>Gentile cliente, ...</p>\n<p>Ordine: {{anagrafica.numeroOrdine}}</p>`}
              className={cn(
                "mt-1 w-full rounded-lg border border-stroke bg-transparent px-3 py-2 text-sm text-dark outline-none focus:border-primary",
                "dark:border-dark-3 dark:text-white"
              )}
            />
            <p className="mt-1 text-[11px] text-dark/60 dark:text-white/60">
              Qui metterai poi i placeholder che già supporti con i tuoi template.
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-[11px] text-dark/60 dark:text-white/60">
              ID azione: <span className="font-mono">{x.id}</span>
              {x.rule.updatedAt ? (
                <>
                  {" "}· Ultimo aggiornamento:{" "}
                  {new Date(x.rule.updatedAt).toLocaleString()}
                </>
              ) : null}
            </div>

            <button
              onClick={() => saveOne(x)}
              disabled={isBusy}
              className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60"
            >
              {isBusy && (
                <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              )}
              {isBusy ? "Salvo..." : "Salva regola"}
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="rounded-[10px] border border-stroke bg-white p-4 shadow-1 dark:border-dark-3 dark:bg-gray-dark dark:shadow-card">
      <div className="border-b border-stroke pb-3 dark:border-dark-3">
        <h2 className="text-base font-semibold text-dark dark:text-white">
          Email per Azioni
        </h2>
        <p className="mt-1 text-xs text-dark/60 dark:text-white/60">
          Elenco completo delle azioni configurate nei file di config.
          Qui puoi associare (o disabilitare) la regola email per ognuna.
        </p>
      </div>

      <div className="pt-4">
        <InlineAlert notice={notice} onClose={() => setNotice(null)} />

        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="h-28 animate-pulse rounded-xl bg-gray-2 dark:bg-dark-2"
              />
            ))}
          </div>
        ) : (
          <div className="space-y-8">
            <section>
              <h3 className="mb-3 text-sm font-semibold text-dark/80 dark:text-white/80">
                Azioni Anagrafiche ({grouped.anagrafiche.length})
              </h3>
              <div className="space-y-4">
                {grouped.anagrafiche.map(renderCard)}
              </div>
            </section>

            <section>
              <h3 className="mb-3 text-sm font-semibold text-dark/80 dark:text-white/80">
                Azioni Aule ({grouped.aule.length})
              </h3>
              <div className="space-y-4">
                {grouped.aule.map(renderCard)}
              </div>
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
