// src/components/Admin/MailAdminPanel.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { ROLES, AppRole } from "@/types/roles";
import { cn } from "@/server-utils/lib/utils";
import { getEventiList } from "@/config/eventi.registry";

type Avviso = { tipo: "successo" | "errore" | "info"; testo: string } | null;

function InlineAlert({ avviso, onClose }: { avviso: Avviso; onClose: () => void }) {
  if (!avviso) return null;

  const tone =
    avviso.tipo === "successo"
      ? "bg-green-50 border-green-500 text-green-800 dark:bg-green-900/30 dark:border-green-400 dark:text-green-100"
      : avviso.tipo === "errore"
        ? "bg-red-50 border-red-500 text-red-800 dark:bg-red-900/30 dark:border-red-400 dark:text-red-100"
        : "bg-blue-50 border-blue-500 text-blue-800 dark:bg-blue-900/30 dark:border-blue-400 dark:text-blue-100";

  const icon = avviso.tipo === "successo" ? "✔️" : avviso.tipo === "errore" ? "⚠️" : "ℹ️";

  return (
    <div role="alert" aria-live="polite" className={`mb-3 flex items-start gap-2 rounded-lg border px-3 py-2 ${tone}`}>
      <span className="mt-0.5">{icon}</span>
      <p className="text-sm leading-5">{avviso.testo}</p>
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

type MailConfig = {
  domain: string; // es: schulzitalia.it
  reservedLocalPart: string; // es: system
  defaultFromName?: string; // es: SchulzAreaRiservata
  defaultFromEmail: string; // es: system@schulzitalia.it
};

type EmailIdentity = {
  _id: string;
  label: string;
  fromName: string;
  fromEmail: string;
  replyToEmail?: string;
  enabled: boolean;
};

type RolePolicy = {
  _id: string;
  role: AppRole;
  canSend: boolean;
  senderIdentityId?: string;
};

type MailSettings = {
  _id: string;
  enabled: boolean;
  systemSenderIdentityId?: string;
};

type MailEventAutoConfig = {
  enabled: boolean;
  eventoType: string;
  timeKind: "point" | "interval" | "deadline" | "recurring_master";
  startAtSource: "now" | "var";
  startAtVarPath?: string;
  endAtSource?: "var";
  endAtVarPath?: string;
  allDay?: boolean;

  // visibilità: vuoto = solo proprietario (qui la forziamo a null)
  visibilityRole?: string | null;

  dataPreset?: Record<string, any>;

  partecipante?: {
    anagraficaType?: string;
    anagraficaIdVarPath?: string;
    role?: string | null;
    status?: string | null;
    quantity?: number | null;
    note?: string | null;
  };
  gruppo?: {
    gruppoType?: string;
    gruppoIdVarPath?: string;
  };
};

type MailTemplate = {
  _id: string;
  key: string;
  name: string;
  subject: string;
  html: string;
  enabled: boolean;
  description?: string;

  eventAuto?: MailEventAutoConfig;
};

type EventDataField = {
  key: string;
  label?: string;
  type?: "string" | "text" | "number" | "boolean" | "select" | "json";
  placeholder?: string;
  help?: string;
  required?: boolean;
  options?: Array<{ value: string; label: string }>;
};

async function jsonFetch(url: string, init?: RequestInit) {
  const res = await fetch(url, { ...init, credentials: "include", cache: "no-store" });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json?.error || json?.message || `HTTP_${res.status}`);
  return json;
}


function getLocalPart(email: string) {
  return (email.split("@")[0] || "").trim().toLowerCase();
}

/**
 * Cerca di estrarre i campi "data" dal catalogo eventi.
 * Supporta più shape possibili per non “rompersi” se cambia.
 */
function extractEventDataFields(ev: any): EventDataField[] {
  const candidates =
    ev?.dataFields ??
    ev?.dataSchema?.fields ??
    ev?.schema?.data?.fields ??
    ev?.schema?.fields ??
    ev?.fields ??
    null;

  if (!candidates) return [];

  // Se è un array già in forma “fields”
  if (Array.isArray(candidates)) {
    return candidates
      .map((f: any) => {
        if (!f) return null;
        const key = String(f.key ?? f.name ?? "").trim();
        if (!key) return null;
        const typeRaw = String(f.type ?? f.kind ?? "string").toLowerCase();
        const type: EventDataField["type"] =
          typeRaw.includes("bool") ? "boolean" :
            typeRaw.includes("num") || typeRaw.includes("int") || typeRaw.includes("float") ? "number" :
              typeRaw.includes("text") || typeRaw.includes("textarea") ? "text" :
                typeRaw.includes("select") || typeRaw.includes("enum") ? "select" :
                  typeRaw.includes("json") || typeRaw.includes("object") ? "json" :
                    "string";

        const options =
          Array.isArray(f.options)
            ? f.options.map((o: any) => ({
              value: String(o.value ?? o.id ?? o ?? ""),
              label: String(o.label ?? o.name ?? o.value ?? o.id ?? o ?? ""),
            }))
            : undefined;

        return {
          key,
          label: f.label ?? f.title ?? key,
          type,
          placeholder: f.placeholder,
          help: f.help ?? f.description,
          required: Boolean(f.required),
          options,
        } as EventDataField;
      })
      .filter(Boolean) as EventDataField[];
  }

  // Se è un oggetto { campo: "string" } o { campo: {type,label...} }
  if (candidates && typeof candidates === "object") {
    return Object.entries(candidates).map(([k, v]: [string, any]) => {
      const key = String(k).trim();
      if (!key) return null;
      if (typeof v === "string") {
        const t = v.toLowerCase();
        const type: EventDataField["type"] =
          t.includes("bool") ? "boolean" :
            t.includes("num") ? "number" :
              t.includes("text") ? "text" :
                t.includes("select") || t.includes("enum") ? "select" :
                  t.includes("json") || t.includes("object") ? "json" :
                    "string";
        return { key, label: key, type } as EventDataField;
      }
      const typeRaw = String(v?.type ?? v?.kind ?? "string").toLowerCase();
      const type: EventDataField["type"] =
        typeRaw.includes("bool") ? "boolean" :
          typeRaw.includes("num") ? "number" :
            typeRaw.includes("text") ? "text" :
              typeRaw.includes("select") || typeRaw.includes("enum") ? "select" :
                typeRaw.includes("json") || typeRaw.includes("object") ? "json" :
                  "string";

      const options =
        Array.isArray(v?.options)
          ? v.options.map((o: any) => ({
            value: String(o.value ?? o.id ?? o ?? ""),
            label: String(o.label ?? o.name ?? o.value ?? o.id ?? o ?? ""),
          }))
          : undefined;

      return {
        key,
        label: v?.label ?? v?.title ?? key,
        type,
        placeholder: v?.placeholder,
        help: v?.help ?? v?.description,
        required: Boolean(v?.required),
        options,
      } as EventDataField;
    }).filter(Boolean) as EventDataField[];
  }

  return [];
}

function normalizeEventAuto(input: MailEventAutoConfig): MailEventAutoConfig {
  // Forza sempre solo proprietario
  return { ...input, visibilityRole: null };
}

function isPlainObject(v: any) {
  return v != null && typeof v === "object" && !Array.isArray(v);
}

function safeParseInlineJson(input: string): { ok: true; value: any } | { ok: false; error: string } {
  const raw = (input || "").trim();
  if (!raw) return { ok: true, value: {} };
  try {
    return { ok: true, value: JSON.parse(raw) };
  } catch (e: any) {
    return { ok: false, error: e?.message || "JSON non valido" };
  }
}

export default function MailAdminPanel() {
  const [avviso, setAvviso] = useState<Avviso>(null);

  const [mailCfg, setMailCfg] = useState<MailConfig | null>(null);
  const [identities, setIdentities] = useState<EmailIdentity[]>([]);
  const [policies, setPolicies] = useState<RolePolicy[]>([]);
  const [settings, setSettings] = useState<MailSettings | null>(null);
  const [templates, setTemplates] = useState<MailTemplate[]>([]);

  const [loading, setLoading] = useState(true);

  // Form creazione mittente
  const [newLabel, setNewLabel] = useState("Assistenza");
  const [newFromName, setNewFromName] = useState("");
  const [newLocalPart, setNewLocalPart] = useState("assistenza");
  const [newReplyTo, setNewReplyTo] = useState("");

  // Editor template
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const selectedTemplate = useMemo(
    () => templates.find((t) => t._id === selectedTemplateId) || null,
    [templates, selectedTemplateId]
  );

  // ✅ form guidato preset evento
  const [eventPresetDraft, setEventPresetDraft] = useState<Record<string, any>>({});
  const [customFieldDefs, setCustomFieldDefs] = useState<EventDataField[]>([]);

  // sincronizza presetDraft quando cambia template selezionato
  useEffect(() => {
    if (!selectedTemplate) {
      setEventPresetDraft({});
      setCustomFieldDefs([]);
      return;
    }
    const obj = selectedTemplate.eventAuto?.dataPreset ?? {};
    setEventPresetDraft(isPlainObject(obj) ? obj : {});
    setCustomFieldDefs([]);
  }, [selectedTemplate?._id, selectedTemplate?.eventAuto]);



  useEffect(() => {
    if (!avviso) return;
    const t = setTimeout(() => setAvviso(null), 4000);
    return () => clearTimeout(t);
  }, [avviso]);

  async function reloadAll() {
    setLoading(true);
    try {
      const [cfg, a, b, c, d] = await Promise.all([
        jsonFetch("/api/admin/mail/config"),
        jsonFetch("/api/admin/mail/identities"),
        jsonFetch("/api/admin/mail/policies"),
        jsonFetch("/api/admin/mail/settings"),
        jsonFetch("/api/admin/mail/templates"),
      ]);

      if (!cfg?.domain || !cfg?.reservedLocalPart) {
        throw new Error("Configurazione EMAIL_FROM non valida (config non disponibile).");
      }

      setMailCfg(cfg as MailConfig);
      setIdentities(a.items || []);
      setPolicies(b.items || []);
      setSettings(c.item || null);
      setTemplates(d.items || []);
      setSelectedTemplateId((prev) => prev || (d.items?.[0]?._id ?? null));

      // Default nome mittente: se vuoto, prova a usare quello del config
      setNewFromName((prev) => prev || cfg.defaultFromName || "Schulz");
    } catch (e: any) {
      setAvviso({ tipo: "errore", testo: e?.message || "Errore caricamento dati email" });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    reloadAll();
  }, []);

  const policyByRole = useMemo(() => {
    const m = new Map<AppRole, RolePolicy>();
    for (const p of policies) m.set(p.role, p);
    return m;
  }, [policies]);

  const enabledIdentities = useMemo(() => identities.filter((i) => i.enabled), [identities]);

  // Mittenti selezionabili per i ruoli: escludi local-part riservato (system)
  const roleAssignableIdentities = useMemo(() => {
    const reserved = mailCfg?.reservedLocalPart?.toLowerCase();
    if (!reserved) return enabledIdentities;
    return enabledIdentities.filter((i) => getLocalPart(i.fromEmail) !== reserved);
  }, [enabledIdentities, mailCfg]);

  async function createIdentity() {
    try {
      if (!mailCfg?.domain) throw new Error("Dominio non disponibile.");
      const local = newLocalPart.trim().toLowerCase();

      if (!local) {
        setAvviso({ tipo: "errore", testo: "Inserisci la parte prima della @ (es. assistenza)." });
        return;
      }
      if (!/^[a-z0-9._+-]+$/i.test(local)) {
        setAvviso({ tipo: "errore", testo: "La parte prima della @ contiene caratteri non validi." });
        return;
      }
      if (mailCfg?.reservedLocalPart?.toLowerCase() === local) {
        setAvviso({
          tipo: "errore",
          testo: `L'indirizzo "${local}@${mailCfg.domain}" è riservato al sistema e non può essere creato come mittente ruolo.`,
        });
        return;
      }

      const fromEmail = `${local}@${mailCfg.domain}`;

      await jsonFetch("/api/admin/mail/identities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          label: newLabel.trim(),
          fromName: (newFromName || mailCfg.defaultFromName || "Schulz").trim(),
          fromEmail,
          replyToEmail: newReplyTo.trim() || undefined,
          enabled: true,
        }),
      });

      setAvviso({ tipo: "successo", testo: "Mittente creato correttamente." });
      await reloadAll();
    } catch (e: any) {
      setAvviso({ tipo: "errore", testo: e?.message || "Errore creazione mittente" });
    }
  }

  async function patchIdentity(id: string, patch: Partial<EmailIdentity>) {
    try {
      await jsonFetch(`/api/admin/mail/identities/${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });

      // ✅ update locale
      setIdentities((prev) => prev.map((x) => (x._id === id ? ({ ...x, ...patch } as any) : x)));
    } catch (e: any) {
      setAvviso({ tipo: "errore", testo: e?.message || "Errore aggiornamento mittente" });
    }
  }

  async function deleteIdentity(id: string) {
    const ok = confirm("Eliminare questo mittente?");
    if (!ok) return;

    try {
      await jsonFetch(`/api/admin/mail/identities/${encodeURIComponent(id)}`, { method: "DELETE" });
      setAvviso({ tipo: "successo", testo: "Mittente eliminato." });
      await reloadAll();
    } catch (e: any) {
      setAvviso({ tipo: "errore", testo: e?.message || "Errore eliminazione mittente" });
    }
  }

  async function upsertPolicy(role: AppRole, canSend: boolean, senderIdentityId?: string) {
    try {
      const payload = { canSend, senderIdentityId: senderIdentityId || undefined };
      const json = await jsonFetch(`/api/admin/mail/policies/${encodeURIComponent(role)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const item = json.item as RolePolicy;
      setPolicies((prev) => {
        const rest = prev.filter((p) => p.role !== role);
        return [...rest, item];
      });

      setAvviso({ tipo: "successo", testo: `Policy aggiornata per il ruolo: ${role}` });
    } catch (e: any) {
      setAvviso({ tipo: "errore", testo: e?.message || "Errore aggiornamento policy ruolo" });
    }
  }

  async function patchSettings(patch: Partial<MailSettings>) {
    try {
      const json = await jsonFetch(`/api/admin/mail/settings`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      setSettings(json.item);
      setAvviso({ tipo: "successo", testo: "Impostazioni globali aggiornate." });
    } catch (e: any) {
      setAvviso({ tipo: "errore", testo: e?.message || "Errore aggiornamento impostazioni globali" });
    }
  }

  async function patchTemplate(id: string, patch: Partial<MailTemplate>) {
    try {
      const json = await jsonFetch(`/api/admin/mail/templates/${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });

      let item = json.item as MailTemplate;

      // ✅ FIX: se sto patchando eventAuto ma il backend non lo ritorna (o lo scarta),
      // faccio merge col valore che ho appena inviato, così la spunta non "salta".
      if (patch.eventAuto !== undefined && item && item.eventAuto === undefined) {
        item = { ...item, eventAuto: patch.eventAuto as any };
      }

      // ✅ allinea form preset quando aggiorno il template selezionato
      if (item?._id === selectedTemplateId) {
        const obj = item.eventAuto?.dataPreset ?? {};
        setEventPresetDraft(isPlainObject(obj) ? obj : {});
      }

      setTemplates((prev) => prev.map((t) => (t._id === id ? item : t)));
      setAvviso({ tipo: "successo", testo: "Template aggiornato." });
    } catch (e: any) {
      setAvviso({ tipo: "errore", testo: e?.message || "Errore aggiornamento template" });
    }
  }

  async function createTemplate() {
    const key = prompt("Inserisci la chiave del template (es: support.new_message)");
    if (!key) return;

    try {
      const payload: Partial<MailTemplate> = {
        key: key.trim(),
        name: key.trim(),
        subject: "Nuovo messaggio da {{name}}",
        html: "<p><strong>Nome:</strong> {{name}}</p><p><strong>Messaggio:</strong><br/>{{message}}</p>",
        enabled: true,
      };

      await jsonFetch(`/api/admin/mail/templates`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      setAvviso({ tipo: "successo", testo: "Template creato." });
      await reloadAll();
    } catch (e: any) {
      setAvviso({ tipo: "errore", testo: e?.message || "Errore creazione template" });
    }
  }

  async function deleteTemplate(id: string) {
    const ok = confirm("Eliminare questo template?");
    if (!ok) return;

    try {
      await jsonFetch(`/api/admin/mail/templates/${encodeURIComponent(id)}`, { method: "DELETE" });
      setAvviso({ tipo: "successo", testo: "Template eliminato." });
      await reloadAll();
    } catch (e: any) {
      setAvviso({ tipo: "errore", testo: e?.message || "Errore eliminazione template" });
    }
  }

  // In settings globali: includi anche il system sender (da env), anche se non esiste in identities
  const systemSenderOption = useMemo(() => {
    if (!mailCfg?.defaultFromEmail) return null;
    return {
      id: "__ENV_SYSTEM__",
      label: `Sistema (da .env) · ${mailCfg.defaultFromEmail}`,
    };
  }, [mailCfg]);

  const eventiCatalog = useMemo(() => {
    try {
      const list = getEventiList() as any[];
      return (list || []).map((e) => ({
        slug: String(e.slug ?? ""),
        label: String(e.label ?? e.name ?? e.slug ?? ""),
        dataFields: extractEventDataFields(e),
      }));
    } catch {
      return [] as Array<{ slug: string; label: string; dataFields: EventDataField[] }>;
    }
  }, []);

  const eventiOptions = useMemo(() => {
    return eventiCatalog.map((e) => ({ slug: e.slug, label: e.label }));
  }, [eventiCatalog]);

  const selectedEventoFields = useMemo(() => {
    const slug = selectedTemplate?.eventAuto?.eventoType || "";
    const found = eventiCatalog.find((x) => x.slug === slug);
    return found?.dataFields ?? [];
  }, [eventiCatalog, selectedTemplate?.eventAuto?.eventoType]);

  const effectiveFields = useMemo(() => {
    // se ho campi dal catalogo uso quelli, altrimenti uso quelli custom che l’utente crea al volo
    return selectedEventoFields.length > 0 ? selectedEventoFields : customFieldDefs;
  }, [selectedEventoFields, customFieldDefs]);

  function updatePresetValue(key: string, value: any) {
    setEventPresetDraft((prev) => ({ ...prev, [key]: value }));
  }

  function removePresetKey(key: string) {
    setEventPresetDraft((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }

  function addCustomField() {
    const key = (prompt("Key del campo (es: titolo, descrizione, priorita)") || "").trim();
    if (!key) return;

    const typeRaw = (prompt("Tipo campo: string | text | number | boolean | select | json", "string") || "string")
      .trim()
      .toLowerCase();

    const type: EventDataField["type"] =
      typeRaw === "text" || typeRaw === "textarea" ? "text" :
        typeRaw === "number" ? "number" :
          typeRaw === "boolean" || typeRaw === "bool" ? "boolean" :
            typeRaw === "select" || typeRaw === "enum" ? "select" :
              typeRaw === "json" || typeRaw === "object" ? "json" :
                "string";

    let options: EventDataField["options"] | undefined = undefined;
    if (type === "select") {
      const raw = prompt('Opzioni (formato: "a:Label A,b:Label B,c:Label C")', "a:A,b:B") || "";
      const parsed = raw
        .split(",")
        .map((x) => x.trim())
        .filter(Boolean)
        .map((pair) => {
          const [v, l] = pair.split(":");
          const value = (v || "").trim();
          const label = (l || v || "").trim();
          return value ? { value, label } : null;
        })
        .filter(Boolean) as Array<{ value: string; label: string }>;
      options = parsed.length ? parsed : undefined;
    }

    setCustomFieldDefs((prev) => {
      if (prev.some((f) => f.key === key)) return prev;
      return [...prev, { key, label: key, type, options }];
    });

    // init value
    setEventPresetDraft((prev) => {
      if (prev[key] !== undefined) return prev;
      const init =
        type === "boolean" ? false :
          type === "number" ? 0 :
            type === "json" ? {} :
              "";
      return { ...prev, [key]: init };
    });
  }

  function savePresetToTemplate() {
    if (!selectedTemplate?.eventAuto) return;

    const nextAuto: MailEventAutoConfig = normalizeEventAuto({
      ...selectedTemplate.eventAuto,
      dataPreset: eventPresetDraft,
    });

    // aggiorna local
    setTemplates((prev) =>
      prev.map((t) => (t._id === selectedTemplate._id ? { ...t, eventAuto: nextAuto } : t))
    );

    // salva
    patchTemplate(selectedTemplate._id, { eventAuto: nextAuto });
    setAvviso({ tipo: "successo", testo: "Campi evento salvati." });
  }

  if (loading) {
    return (
      <div className="rounded-[10px] border border-stroke bg-white p-4 shadow-1 dark:border-dark-3 dark:bg-gray-dark dark:shadow-card">
        <div className="animate-pulse space-y-3">
          <div className="h-6 w-72 rounded bg-gray-2 dark:bg-dark-2" />
          <div className="h-24 rounded bg-gray-2 dark:bg-dark-2" />
          <div className="h-24 rounded bg-gray-2 dark:bg-dark-2" />
          <div className="h-24 rounded bg-gray-2 dark:bg-dark-2" />
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-[10px] border border-stroke bg-white shadow-1 dark:border-dark-3 dark:bg-gray-dark dark:shadow-card">
      <div className="border-b border-stroke px-4 py-3 dark:border-dark-3">
        <h1 className="text-base font-semibold text-dark dark:text-white">Amministrazione Email</h1>
        <p className="mt-1 text-xs text-dark/60 dark:text-white/60">
          Dominio bloccato da <span className="font-mono">EMAIL_FROM</span>:{" "}
          <span className="font-mono">{mailCfg?.domain}</span> · Mittente riservato:{" "}
          <span className="font-mono">{mailCfg?.defaultFromEmail}</span>
        </p>
      </div>

      <div className="p-4">
        <InlineAlert avviso={avviso} onClose={() => setAvviso(null)} />

        {/* 1) MITTENTI */}
        <section className="mb-6 rounded-lg border border-stroke p-4 dark:border-dark-3">
          <div className="mb-3 flex items-start justify-between gap-3">
            <div>
              <div className="font-semibold text-dark dark:text-white">1) Mittenti (From)</div>
              <div className="text-xs text-dark/60 dark:text-white/60">
                Inserisci solo la parte prima della @. Il dominio è bloccato.
              </div>
            </div>

            <button
              onClick={reloadAll}
              className="rounded-md border border-stroke px-3 py-1.5 text-xs font-medium text-dark hover:bg-gray-2 dark:border-dark-3 dark:text-white dark:hover:bg-dark-2"
            >
              Ricarica
            </button>
          </div>

          <div className="grid gap-3 md:grid-cols-4">
            <label className="text-xs text-dark dark:text-white">
              Etichetta
              <input
                className="mt-1 w-full rounded-md border border-stroke bg-transparent px-2 py-1.5 text-xs dark:border-dark-3"
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                placeholder="Assistenza"
              />
            </label>

            <label className="text-xs text-dark dark:text-white">
              Nome mittente
              <input
                className="mt-1 w-full rounded-md border border-stroke bg-transparent px-2 py-1.5 text-xs dark:border-dark-3"
                value={newFromName}
                onChange={(e) => setNewFromName(e.target.value)}
                placeholder={mailCfg?.defaultFromName || "Schulz"}
              />
            </label>

            <label className="text-xs text-dark dark:text-white">
              Email (solo parte prima della @)
              <div className="mt-1 flex items-center gap-2">
                <input
                  className="w-full rounded-md border border-stroke bg-transparent px-2 py-1.5 text-xs dark:border-dark-3"
                  value={newLocalPart}
                  onChange={(e) => setNewLocalPart(e.target.value.replace(/\s+/g, ""))}
                  placeholder="assistenza"
                />
                <span className="text-xs text-dark/60 dark:text-white/60">@{mailCfg?.domain || "—"}</span>
              </div>
              <div className="mt-1 text-[11px] text-dark/60 dark:text-white/60">
                Non puoi usare: <span className="font-mono">{mailCfg?.reservedLocalPart}</span> (riservato al sistema)
              </div>
            </label>

            <label className="text-xs text-dark dark:text-white">
              Rispondi a (Reply-To) — opzionale
              <input
                className="mt-1 w-full rounded-md border border-stroke bg-transparent px-2 py-1.5 text-xs dark:border-dark-3"
                value={newReplyTo}
                onChange={(e) => setNewReplyTo(e.target.value)}
                placeholder="assistenza@… (se diverso)"
              />
              <div className="mt-1 text-[11px] text-dark/60 dark:text-white/60">
                Indirizzo usato quando il destinatario clicca “Rispondi”.
              </div>
            </label>
          </div>

          <button
            onClick={createIdentity}
            className="mt-3 inline-flex items-center rounded-md bg-primary px-4 py-2 text-xs font-semibold text-white hover:opacity-90"
          >
            Crea mittente
          </button>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="text-left text-dark/70 dark:text-white/70">
              <tr className="border-b border-stroke dark:border-dark-3">
                <th className="py-2">Attivo</th>
                <th>Etichetta</th>
                <th>From</th>
                <th>Rispondi a</th>
                <th className="text-right">Azioni</th>
              </tr>
              </thead>

              <tbody>
              {identities.map((it) => {
                const isReserved = getLocalPart(it.fromEmail) === (mailCfg?.reservedLocalPart || "").toLowerCase();

                return (
                  <tr key={it._id} className="border-b border-stroke dark:border-dark-3">
                    <td className="py-2">
                      <input
                        type="checkbox"
                        checked={it.enabled}
                        onChange={(e) => patchIdentity(it._id, { enabled: e.target.checked })}
                      />
                    </td>

                    <td className="py-2">
                      <input
                        className="w-full rounded border border-stroke bg-transparent px-2 py-1 dark:border-dark-3"
                        value={it.label}
                        onChange={(e) =>
                          setIdentities((prev) =>
                            prev.map((x) => (x._id === it._id ? { ...x, label: e.target.value } : x))
                          )
                        }
                        onBlur={() => patchIdentity(it._id, { label: it.label })}
                      />
                      {isReserved && (
                        <div className="mt-1 text-[10px] font-semibold text-red-600">
                          Riservato (system): non assegnabile ai ruoli
                        </div>
                      )}
                    </td>

                    <td className="py-2">
                      <div className="grid gap-1 md:grid-cols-2">
                        <input
                          className="rounded border border-stroke bg-transparent px-2 py-1 dark:border-dark-3"
                          value={it.fromName}
                          onChange={(e) =>
                            setIdentities((prev) =>
                              prev.map((x) => (x._id === it._id ? { ...x, fromName: e.target.value } : x))
                            )
                          }
                          onBlur={() => patchIdentity(it._id, { fromName: it.fromName })}
                        />
                        <input
                          className="rounded border border-stroke bg-transparent px-2 py-1 opacity-70 dark:border-dark-3"
                          value={it.fromEmail}
                          disabled
                          title="L'email del mittente è vincolata al dominio configurato."
                        />
                      </div>
                    </td>

                    <td className="py-2">
                      <input
                        className="w-full rounded border border-stroke bg-transparent px-2 py-1 dark:border-dark-3"
                        value={it.replyToEmail || ""}
                        placeholder="(vuoto)"
                        onChange={(e) =>
                          setIdentities((prev) =>
                            prev.map((x) => (x._id === it._id ? { ...x, replyToEmail: e.target.value } : x))
                          )
                        }
                        onBlur={() => patchIdentity(it._id, { replyToEmail: it.replyToEmail || undefined })}
                      />
                    </td>

                    <td className="py-2 text-right">
                      <button
                        onClick={() => deleteIdentity(it._id)}
                        className="rounded-md bg-red-500 px-3 py-1 text-[11px] font-semibold text-white hover:opacity-90"
                      >
                        Elimina
                      </button>
                    </td>
                  </tr>
                );
              })}

              {identities.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-4 text-center text-xs text-dark/60 dark:text-white/60">
                    Nessun mittente presente. Creane uno.
                  </td>
                </tr>
              )}
              </tbody>
            </table>
          </div>
        </section>

        {/* 2) POLICY RUOLI */}
        <section className="mb-6 rounded-lg border border-stroke p-4 dark:border-dark-3">
          <div className="mb-3">
            <div className="font-semibold text-dark dark:text-white">2) Permessi e Mittente per Ruolo</div>
            <div className="text-xs text-dark/60 dark:text-white/60">
              Scegli chi può inviare email e quale mittente usare di default. Il mittente <b>system</b> è escluso.
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="text-left text-dark/70 dark:text-white/70">
              <tr className="border-b border-stroke dark:border-dark-3">
                <th className="py-2">Ruolo</th>
                <th>Può inviare</th>
                <th>Mittente predefinito</th>
                <th className="text-right">Stato</th>
              </tr>
              </thead>

              <tbody>
              {ROLES.map((role) => {
                const p = policyByRole.get(role as AppRole);
                const canSend = p?.canSend ?? false;
                const senderIdentityId = p?.senderIdentityId ?? "";
                const senderOk = !canSend || !!senderIdentityId;

                return (
                  <tr key={role} className="border-b border-stroke dark:border-dark-3">
                    <td className="py-2 font-medium text-dark dark:text-white">{role}</td>

                    <td className="py-2">
                      <input
                        type="checkbox"
                        checked={canSend}
                        onChange={(e) => upsertPolicy(role as AppRole, e.target.checked, senderIdentityId || undefined)}
                      />
                    </td>

                    <td className="py-2">
                      <select
                        className={cn(
                          "w-full rounded-md border border-stroke bg-transparent px-2 py-1.5 text-xs dark:border-dark-3",
                          !canSend && "opacity-60"
                        )}
                        disabled={!canSend}
                        value={senderIdentityId}
                        onChange={(e) => upsertPolicy(role as AppRole, canSend, e.target.value || undefined)}
                      >
                        <option value="">— nessuno —</option>
                        {roleAssignableIdentities.map((i) => (
                          <option key={i._id} value={i._id}>
                            {i.label} · {i.fromEmail}
                          </option>
                        ))}
                      </select>
                    </td>

                    <td className="py-2 text-right">
                        <span
                          className={cn(
                            "rounded-full px-2 py-0.5 text-[11px] font-semibold",
                            senderOk ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-800"
                          )}
                        >
                          {senderOk ? "OK" : "Manca mittente"}
                        </span>
                    </td>
                  </tr>
                );
              })}
              </tbody>
            </table>
          </div>
        </section>

        {/* 3) SETTINGS GLOBALI */}
        <section className="mb-6 rounded-lg border border-stroke p-4 dark:border-dark-3">
          <div className="mb-3">
            <div className="font-semibold text-dark dark:text-white">3) Impostazioni globali (Sistema)</div>
            <div className="text-xs text-dark/60 dark:text-white/60">
              Qui imposti il mittente usato per gli <b>avvisi automatici</b>. Qui è consentito usare il mittente “system”.
            </div>
          </div>

          <div className="flex flex-col gap-3 md:flex-row md:items-center">
            <label className="flex items-center gap-2 text-xs text-dark dark:text-white">
              <input
                type="checkbox"
                checked={settings?.enabled ?? true}
                onChange={(e) => patchSettings({ enabled: e.target.checked })}
              />
              Sistema email abilitato
            </label>

            <div className="flex-1" />

            <div className="w-full md:w-[520px]">
              <div className="mb-1 text-[11px] text-dark/70 dark:text-white/70">Mittente di sistema</div>

              <select
                className="w-full rounded-md border border-stroke bg-transparent px-2 py-1.5 text-xs dark:border-dark-3"
                value={settings?.systemSenderIdentityId || "__ENV_SYSTEM__"}
                onChange={(e) => {
                  const v = e.target.value;
                  if (v === "__ENV_SYSTEM__") {
                    patchSettings({ systemSenderIdentityId: undefined });
                  } else {
                    patchSettings({ systemSenderIdentityId: v || undefined });
                  }
                }}
              >
                {systemSenderOption && <option value="__ENV_SYSTEM__">{systemSenderOption.label}</option>}
                <option value="">— non configurato —</option>
                {enabledIdentities.map((i) => (
                  <option key={i._id} value={i._id}>
                    {i.label} · {i.fromEmail}
                  </option>
                ))}
              </select>

              <div className="mt-1 text-[11px] text-dark/60 dark:text-white/60">
                Se selezioni “Sistema (da .env)”, l’app userà <span className="font-mono">{mailCfg?.defaultFromEmail}</span>.
              </div>
            </div>
          </div>
        </section>

        {/* 4) TEMPLATES */}
        <section className="rounded-lg border border-stroke p-4 dark:border-dark-3">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <div className="font-semibold text-dark dark:text-white">4) Template Email</div>
              <div className="text-xs text-dark/60 dark:text-white/60">
                Oggetto/HTML modificabili da admin. Puoi usare variabili tipo{" "}
                <span className="font-mono">{"{{name}}"}</span>.
              </div>
            </div>

            <button
              onClick={createTemplate}
              className="rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90"
            >
              Nuovo template
            </button>
          </div>

          <div className="grid gap-4 md:grid-cols-[280px,1fr]">
            {/* lista */}
            <div className="rounded-md border border-stroke p-2 dark:border-dark-3">
              <div className="mb-2 text-[11px] font-semibold text-dark/70 dark:text-white/70">
                Elenco ({templates.length})
              </div>

              <div className="max-h-[420px] overflow-y-auto space-y-1 pr-1">
                {templates.map((t) => {
                  const active = t._id === selectedTemplateId;
                  return (
                    <button
                      key={t._id}
                      onClick={() => setSelectedTemplateId(t._id)}
                      className={cn(
                        "w-full rounded-md border px-2 py-2 text-left text-xs transition-colors",
                        "border-stroke dark:border-dark-3",
                        active ? "bg-red-100/60 border-primary dark:bg-red-900/30" : "hover:bg-gray-2 dark:hover:bg-dark-2"
                      )}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="truncate font-semibold text-dark dark:text-white">{t.name}</div>
                        <span className={cn("text-[10px] font-bold", t.enabled ? "text-emerald-600" : "text-red-600")}>
                          {t.enabled ? "ATTIVO" : "DISATTIVO"}
                        </span>
                      </div>
                      <div className="mt-0.5 truncate text-[11px] text-dark/70 dark:text-white/70">{t.key}</div>

                      {t.eventAuto?.enabled ? (
                        <div className="mt-1 text-[10px] font-semibold text-primary">
                          Evento: {t.eventAuto.eventoType || "—"}
                        </div>
                      ) : null}
                    </button>
                  );
                })}

                {templates.length === 0 && (
                  <div className="py-6 text-center text-xs text-dark/60 dark:text-white/60">Nessun template presente.</div>
                )}
              </div>
            </div>

            {/* editor */}
            <div className="rounded-md border border-stroke p-3 dark:border-dark-3">
              {!selectedTemplate ? (
                <div className="py-10 text-center text-sm text-dark/60 dark:text-white/60">
                  Seleziona un template a sinistra.
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                    <div>
                      <div className="text-sm font-semibold text-dark dark:text-white">{selectedTemplate.name}</div>
                      <div className="text-[11px] text-dark/70 dark:text-white/70">{selectedTemplate.key}</div>
                    </div>

                    <div className="flex items-center gap-2">
                      <label className="flex items-center gap-2 text-xs text-dark dark:text-white">
                        <input
                          type="checkbox"
                          checked={selectedTemplate.enabled}
                          onChange={(e) => patchTemplate(selectedTemplate._id, { enabled: e.target.checked })}
                        />
                        Attivo
                      </label>

                      <button
                        onClick={() => deleteTemplate(selectedTemplate._id)}
                        className="rounded-md bg-red-500 px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90"
                      >
                        Elimina
                      </button>
                    </div>
                  </div>

                  <label className="block text-xs text-dark dark:text-white">
                    Nome (visibile in admin)
                    <input
                      className="mt-1 w-full rounded-md border border-stroke bg-transparent px-2 py-1.5 text-xs dark:border-dark-3"
                      value={selectedTemplate.name}
                      onChange={(e) =>
                        setTemplates((prev) =>
                          prev.map((t) => (t._id === selectedTemplate._id ? { ...t, name: e.target.value } : t))
                        )
                      }
                      onBlur={() => patchTemplate(selectedTemplate._id, { name: selectedTemplate.name })}
                    />
                  </label>

                  <label className="block text-xs text-dark dark:text-white">
                    Oggetto
                    <input
                      className="mt-1 w-full rounded-md border border-stroke bg-transparent px-2 py-1.5 text-xs dark:border-dark-3"
                      value={selectedTemplate.subject}
                      onChange={(e) =>
                        setTemplates((prev) =>
                          prev.map((t) => (t._id === selectedTemplate._id ? { ...t, subject: e.target.value } : t))
                        )
                      }
                      onBlur={() => patchTemplate(selectedTemplate._id, { subject: selectedTemplate.subject })}
                    />
                  </label>

                  <label className="block text-xs text-dark dark:text-white">
                    HTML
                    <textarea
                      className="mt-1 min-h-[260px] w-full rounded-md border border-stroke bg-transparent px-2 py-1.5 font-mono text-[11px] dark:border-dark-3"
                      value={selectedTemplate.html}
                      onChange={(e) =>
                        setTemplates((prev) =>
                          prev.map((t) => (t._id === selectedTemplate._id ? { ...t, html: e.target.value } : t))
                        )
                      }
                      onBlur={() => patchTemplate(selectedTemplate._id, { html: selectedTemplate.html })}
                    />
                  </label>

                  {/* EVENTO COLLEGATO */}
                  <div className="rounded-md border border-stroke p-3 dark:border-dark-3">
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <div>
                        <div className="text-xs font-semibold text-dark dark:text-white">Evento collegato (opzionale)</div>
                        <div className="text-[11px] text-dark/60 dark:text-white/60">
                          Se abiliti, il client può creare un evento quando usi questo template (via Redux).
                        </div>
                        <div className="mt-1 text-[11px] text-dark/60 dark:text-white/60">
                          Visibilità: <b>solo proprietario</b> (fissa).
                        </div>
                      </div>

                      <label className="flex items-center gap-2 text-xs text-dark dark:text-white">
                        <input
                          type="checkbox"
                          checked={selectedTemplate.eventAuto != null && selectedTemplate.eventAuto.enabled !== false}
                          onChange={(e) => {
                            const enabled = e.target.checked;

                            const current = selectedTemplate.eventAuto;

                            // se già esiste config, NON la butto via: toggle solo enabled
                            const base: MailEventAutoConfig =
                              current
                                ? normalizeEventAuto({ ...current, enabled })
                                : normalizeEventAuto({
                                  enabled: true,
                                  eventoType: eventiOptions[0]?.slug || "",
                                  timeKind: "point",
                                  startAtSource: "now",
                                  allDay: false,
                                  visibilityRole: null,
                                  dataPreset: {},
                                });

                            // se sto disabilitando e current non esiste, creo comunque struttura coerente
                            const next: MailEventAutoConfig = current
                              ? base
                              : enabled
                                ? base
                                : normalizeEventAuto({
                                  enabled: false,
                                  eventoType: "",
                                  timeKind: "point",
                                  startAtSource: "now",
                                  allDay: false,
                                  visibilityRole: null,
                                  dataPreset: {},
                                });

                            setTemplates((prev) =>
                              prev.map((t) => (t._id === selectedTemplate._id ? { ...t, eventAuto: next } : t))
                            );

                            // allinea draft preset
                            setEventPresetDraft(isPlainObject(next.dataPreset) ? next.dataPreset! : {});

                            patchTemplate(selectedTemplate._id, { eventAuto: next });
                          }}
                        />
                        Abilita
                      </label>
                    </div>

                    {selectedTemplate.eventAuto?.enabled ? (
                      <div className="grid gap-3 md:grid-cols-2">
                        <label className="text-xs text-dark dark:text-white">
                          Tipo evento
                          <select
                            className="mt-1 w-full rounded-md border border-stroke bg-transparent px-2 py-1.5 text-xs dark:border-dark-3"
                            value={selectedTemplate.eventAuto.eventoType || ""}
                            onChange={(e) => {
                              const v = e.target.value;
                              const next = normalizeEventAuto({ ...selectedTemplate.eventAuto!, eventoType: v });

                              setTemplates((prev) =>
                                prev.map((t) => (t._id === selectedTemplate._id ? { ...t, eventAuto: next } : t))
                              );

                              // quando cambio tipo, NON distruggo i dati: li lascio.
                              // Se vuoi auto-reset qui, dimmelo e lo faccio.
                              patchTemplate(selectedTemplate._id, { eventAuto: next });
                            }}
                          >
                            <option value="">— seleziona —</option>
                            {eventiOptions.map((o) => (
                              <option key={o.slug} value={o.slug}>
                                {o.label} · {o.slug}
                              </option>
                            ))}
                          </select>
                        </label>

                        <label className="text-xs text-dark dark:text-white">
                          timeKind
                          <select
                            className="mt-1 w-full rounded-md border border-stroke bg-transparent px-2 py-1.5 text-xs dark:border-dark-3"
                            value={selectedTemplate.eventAuto.timeKind}
                            onChange={(e) => {
                              const v = e.target.value as MailEventAutoConfig["timeKind"];
                              const next = normalizeEventAuto({ ...selectedTemplate.eventAuto!, timeKind: v });
                              setTemplates((prev) =>
                                prev.map((t) => (t._id === selectedTemplate._id ? { ...t, eventAuto: next } : t))
                              );
                              patchTemplate(selectedTemplate._id, { eventAuto: next });
                            }}
                          >
                            <option value="point">point</option>
                            <option value="deadline">deadline</option>
                            <option value="interval">interval</option>
                            <option value="recurring_master">recurring_master</option>
                          </select>
                        </label>

                        <label className="text-xs text-dark dark:text-white">
                          startAt source
                          <select
                            className="mt-1 w-full rounded-md border border-stroke bg-transparent px-2 py-1.5 text-xs dark:border-dark-3"
                            value={selectedTemplate.eventAuto.startAtSource}
                            onChange={(e) => {
                              const v = e.target.value as MailEventAutoConfig["startAtSource"];
                              const next = normalizeEventAuto({
                                ...selectedTemplate.eventAuto!,
                                startAtSource: v,
                                startAtVarPath: v === "var" ? (selectedTemplate.eventAuto?.startAtVarPath || "") : undefined,
                              });
                              setTemplates((prev) =>
                                prev.map((t) => (t._id === selectedTemplate._id ? { ...t, eventAuto: next } : t))
                              );
                              patchTemplate(selectedTemplate._id, { eventAuto: next });
                            }}
                          >
                            <option value="now">now (data/ora attuale)</option>
                            <option value="var">var (da variabili)</option>
                          </select>
                        </label>

                        {selectedTemplate.eventAuto.startAtSource === "var" ? (
                          <label className="text-xs text-dark dark:text-white">
                            startAt var path
                            <input
                              className="mt-1 w-full rounded-md border border-stroke bg-transparent px-2 py-1.5 text-xs dark:border-dark-3"
                              value={selectedTemplate.eventAuto.startAtVarPath || ""}
                              onChange={(e) => {
                                const v = e.target.value;
                                const next = normalizeEventAuto({ ...selectedTemplate.eventAuto!, startAtVarPath: v });
                                setTemplates((prev) =>
                                  prev.map((t) => (t._id === selectedTemplate._id ? { ...t, eventAuto: next } : t))
                                );
                              }}
                              onBlur={() => patchTemplate(selectedTemplate._id, { eventAuto: selectedTemplate.eventAuto })}
                              placeholder='es: "anagrafica.dataConsegna"'
                            />
                          </label>
                        ) : null}

                        <label className="flex items-center gap-2 text-xs text-dark dark:text-white md:col-span-2">
                          <input
                            type="checkbox"
                            checked={!!selectedTemplate.eventAuto.allDay}
                            onChange={(e) => {
                              const next = normalizeEventAuto({ ...selectedTemplate.eventAuto!, allDay: e.target.checked });
                              setTemplates((prev) =>
                                prev.map((t) => (t._id === selectedTemplate._id ? { ...t, eventAuto: next } : t))
                              );
                              patchTemplate(selectedTemplate._id, { eventAuto: next });
                            }}
                          />
                          allDay
                        </label>

                        {/* PRESET GUIDATO */}
                        <div className="md:col-span-2 rounded-md border border-stroke p-3 dark:border-dark-3">
                          <div className="mb-2 flex items-center justify-between gap-2">
                            <div>
                              <div className="text-xs font-semibold text-dark dark:text-white">Dati evento (campi)</div>
                              <div className="text-[11px] text-dark/60 dark:text-white/60">
                                Compila i campi del <b>data</b> per il tipo evento selezionato.
                                Le stringhe possono contenere <span className="font-mono">{"{{...}}"}</span>.
                              </div>
                            </div>

                            {selectedEventoFields.length === 0 ? (
                              <button
                                type="button"
                                onClick={addCustomField}
                                className="rounded-md border border-stroke px-3 py-1.5 text-[11px] font-semibold text-dark hover:bg-gray-2 dark:border-dark-3 dark:text-white dark:hover:bg-dark-2"
                              >
                                Aggiungi campo
                              </button>
                            ) : null}
                          </div>

                          {effectiveFields.length === 0 ? (
                            <div className="text-[11px] text-dark/60 dark:text-white/60">
                              Nessun campo definito nel catalogo per questo evento.
                              Usa “Aggiungi campo” per inserirli e compilarli (senza JSON).
                            </div>
                          ) : (
                            <div className="grid gap-3 md:grid-cols-2">
                              {effectiveFields.map((f) => {
                                const value = eventPresetDraft?.[f.key];

                                const label = f.label || f.key;
                                const type = f.type || "string";

                                return (
                                  <div key={f.key} className={cn("rounded-md border border-stroke p-2 dark:border-dark-3", "md:col-span-1")}>
                                    <div className="flex items-start justify-between gap-2">
                                      <div>
                                        <div className="text-[11px] font-semibold text-dark dark:text-white">
                                          {label} <span className="text-[10px] opacity-60">({f.key})</span>
                                        </div>
                                        {f.help ? (
                                          <div className="mt-0.5 text-[10px] text-dark/60 dark:text-white/60">{f.help}</div>
                                        ) : null}
                                      </div>

                                      {selectedEventoFields.length === 0 ? (
                                        <button
                                          type="button"
                                          className="rounded px-2 py-0.5 text-[10px] font-semibold text-red-600 hover:opacity-80"
                                          onClick={() => {
                                            setCustomFieldDefs((prev) => prev.filter((x) => x.key !== f.key));
                                            removePresetKey(f.key);
                                          }}
                                          title="Rimuovi campo"
                                        >
                                          Rimuovi
                                        </button>
                                      ) : null}
                                    </div>

                                    <div className="mt-2">
                                      {type === "boolean" ? (
                                        <label className="flex items-center gap-2 text-xs text-dark dark:text-white">
                                          <input
                                            type="checkbox"
                                            checked={Boolean(value)}
                                            onChange={(e) => updatePresetValue(f.key, e.target.checked)}
                                          />
                                          vero/falso
                                        </label>
                                      ) : type === "number" ? (
                                        <input
                                          className="w-full rounded-md border border-stroke bg-transparent px-2 py-1.5 text-xs dark:border-dark-3"
                                          value={value ?? ""}
                                          onChange={(e) => {
                                            const raw = e.target.value;
                                            const n = raw === "" ? "" : Number(raw);
                                            updatePresetValue(f.key, Number.isNaN(n) ? raw : n);
                                          }}
                                          placeholder={f.placeholder}
                                        />
                                      ) : type === "text" ? (
                                        <textarea
                                          className="min-h-[84px] w-full rounded-md border border-stroke bg-transparent px-2 py-1.5 text-xs dark:border-dark-3"
                                          value={value ?? ""}
                                          onChange={(e) => updatePresetValue(f.key, e.target.value)}
                                          placeholder={f.placeholder}
                                        />
                                      ) : type === "select" ? (
                                        <select
                                          className="w-full rounded-md border border-stroke bg-transparent px-2 py-1.5 text-xs dark:border-dark-3"
                                          value={value ?? ""}
                                          onChange={(e) => updatePresetValue(f.key, e.target.value)}
                                        >
                                          <option value="">— seleziona —</option>
                                          {(f.options || []).map((o) => (
                                            <option key={o.value} value={o.value}>
                                              {o.label}
                                            </option>
                                          ))}
                                        </select>
                                      ) : type === "json" ? (
                                        <div className="space-y-1">
                                          <input
                                            className="w-full rounded-md border border-stroke bg-transparent px-2 py-1.5 font-mono text-[11px] dark:border-dark-3"
                                            value={typeof value === "string" ? value : JSON.stringify(value ?? {})}
                                            onChange={(e) => updatePresetValue(f.key, e.target.value)}
                                            placeholder='{"chiave":"valore"}'
                                          />
                                          <button
                                            type="button"
                                            className="rounded-md border border-stroke px-2 py-1 text-[11px] font-semibold text-dark hover:bg-gray-2 dark:border-dark-3 dark:text-white dark:hover:bg-dark-2"
                                            onClick={() => {
                                              const raw = String(eventPresetDraft?.[f.key] ?? "").trim();
                                              const parsed = safeParseInlineJson(raw);
                                              if (!parsed.ok) {
                                                setAvviso({ tipo: "errore", testo: `Campo "${f.key}": ${parsed.error}` });
                                                return;
                                              }
                                              updatePresetValue(f.key, parsed.value);
                                              setAvviso({ tipo: "successo", testo: `Campo "${f.key}" aggiornato.` });
                                            }}
                                          >
                                            Applica JSON
                                          </button>
                                        </div>
                                      ) : (
                                        <input
                                          className="w-full rounded-md border border-stroke bg-transparent px-2 py-1.5 text-xs dark:border-dark-3"
                                          value={value ?? ""}
                                          onChange={(e) => updatePresetValue(f.key, e.target.value)}
                                          placeholder={f.placeholder}
                                        />
                                      )}
                                    </div>
                                  </div>
                                );
                              })}

                              <div className="md:col-span-2 flex items-center justify-between gap-2">
                                <div className="text-[11px] text-dark/60 dark:text-white/60">
                                  Salvando, l’admin impacchetta questi campi in <span className="font-mono">dataPreset</span>.
                                </div>

                                <button
                                  type="button"
                                  onClick={savePresetToTemplate}
                                  className="rounded-md border border-stroke px-3 py-1.5 text-[11px] font-semibold text-dark hover:bg-gray-2 dark:border-dark-3 dark:text-white dark:hover:bg-dark-2"
                                >
                                  Salva campi
                                </button>
                              </div>
                            </div>
                          )}
                        </div>

                        <div className="md:col-span-2 rounded-md bg-gray-1/40 p-3 text-[11px] text-dark/70 dark:bg-dark-2/50 dark:text-white/70">
                          <div className="font-semibold">Suggerimento rapido</div>
                          <div className="mt-1">
                            Puoi inserire placeholder tipo{" "}
                            <span className="font-mono">{"{{anagrafica.numeroOrdine}}"}</span> nelle stringhe.
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="text-[11px] text-dark/60 dark:text-white/60">
                        Disabilitato. Nessun evento verrà creato.
                      </div>
                    )}
                  </div>

                  <div className="rounded-md bg-gray-1/40 p-3 text-[11px] text-dark/70 dark:bg-dark-2/50 dark:text-white/70">
                    <div className="font-semibold">Suggerimento</div>
                    <div className="mt-1">
                      Puoi usare variabili tipo <span className="font-mono">{"{{name}}"}</span>,{" "}
                      <span className="font-mono">{"{{message}}"}</span>,{" "}
                      <span className="font-mono">{"{{thread.title}}"}</span>.
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
