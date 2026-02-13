"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { cn } from "@/server-utils/lib/utils";

import { useAppDispatch } from "@/components/Store/hooks";
import { createEvento } from "@/components/Store/slices/eventiSlice";

import TemplateList, { MailTemplateLite } from "./TemplateList";
import MailComposer, { SenderOption } from "./MailComposer";
import MailPreview from "./MailPreview";
import RecipientPickerModal from "./RecipientPickerModal";

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
      <button onClick={onClose} className="ml-auto rounded px-1.5 text-xs hover:opacity-80" aria-label="Chiudi notifica">
        ✕
      </button>
    </div>
  );
}

async function jsonFetch<T = any>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { ...init, credentials: "include", cache: "no-store" });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json?.error || json?.message || `HTTP_${res.status}`);
  return json as T;
}

function htmlToText(html: string): string {
  const raw = (html || "").trim();
  if (!raw) return "";

  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(raw, "text/html");
    doc.querySelectorAll("script, style, noscript").forEach((n) => n.remove());
    doc.querySelectorAll("br").forEach((br) => br.replaceWith("\n"));
    doc.querySelectorAll("p, div, li").forEach((el) => el.append("\n"));

    const txt = (doc.body.textContent || "")
      .replace(/\r/g, "")
      .replace(/[ \t]+\n/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();

    return txt;
  } catch {
    return raw.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  }
}

function textToSimpleHtml(text: string): string {
  const t = (text || "").replace(/\r/g, "").trim();
  if (!t) return "";

  const escape = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  const paragraphs = t.split(/\n{2,}/g).map((p) => p.trim()).filter(Boolean);
  return paragraphs.map((p) => `<p>${escape(p).replace(/\n/g, "<br/>")}</p>`).join("\n");
}

/* -------------------------------------------------------------------------- */
/* ✅ EVENT AUTO - HELPERS                                                      */
/* -------------------------------------------------------------------------- */

type MailEventAutoConfig = {
  enabled: boolean;
  eventoType: string;
  timeKind: "point" | "interval" | "deadline" | "recurring_master";
  startAtSource: "now" | "var";
  startAtVarPath?: string;
  endAtSource?: "var";
  endAtVarPath?: string;
  allDay?: boolean;
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

function isPlainObject(v: any) {
  return v != null && typeof v === "object" && !Array.isArray(v);
}

function getByPath(obj: any, path: string | undefined): any {
  if (!obj || !path) return undefined;
  const parts = String(path).split(".").map((x) => x.trim()).filter(Boolean);
  let cur: any = obj;
  for (const p of parts) {
    if (cur == null) return undefined;
    cur = cur[p];
  }
  return cur;
}

function renderTemplateString(input: any, vars: Record<string, any>) {
  if (typeof input !== "string") return input;
  return input.replace(/\{\{\s*([^}]+?)\s*\}\}/g, (_m, expr) => {
    const v = getByPath(vars, String(expr).trim());
    if (v === null || v === undefined) return "";
    if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") return String(v);
    try {
      return JSON.stringify(v);
    } catch {
      return String(v);
    }
  });
}

// ✅ FIX: qui prima avevo scritto “: any ts” e ti esplodeva tutto
function renderPresetDeep(input: any, vars: Record<string, any>): any {
  if (Array.isArray(input)) return input.map((x) => renderPresetDeep(x, vars));
  if (isPlainObject(input)) {
    const out: Record<string, any> = {};
    for (const [k, v] of Object.entries(input)) out[k] = renderPresetDeep(v, vars);
    return out;
  }
  return renderTemplateString(input, vars);
}

function toISODateOrNull(x: any): string | null {
  if (x == null) return null;

  if (x instanceof Date) {
    const t = x.getTime();
    return Number.isFinite(t) ? x.toISOString() : null;
  }

  if (typeof x === "number") {
    const d = new Date(x);
    return Number.isFinite(d.getTime()) ? d.toISOString() : null;
  }

  if (typeof x === "string") {
    const s = x.trim();
    if (!s) return null;
    const d = new Date(s);
    return Number.isFinite(d.getTime()) ? d.toISOString() : null;
  }

  return null;
}

/* -------------------------------------------------------------------------- */
/* TYPES API                                                                    */
/* -------------------------------------------------------------------------- */

type BootstrapResponse = {
  ok: true;
  role: string;
  mailEnabled: boolean;
  canSend: boolean;
  defaultSenderIdentityId?: string;
  senderOptions: SenderOption[];
  templates: Array<MailTemplateLite & { eventAuto?: MailEventAutoConfig }>;
};

type PreviewResponse = {
  ok: true;
  subject: string;
  html: string;
};

type ComposeResponse = {
  ok: true;
  suggestion: {
    vars: Record<string, any>;
    subjectOverride?: string;
  };
  rendered: {
    subject: string;
    html: string;
  };
};

type AnagraficaNode = { typeSlug: string; id: string; data: Record<string, any> };

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

function suggestSenderIdFromEmails(emails: string[], senderOptions: SenderOption[]) {
  const set = new Set((emails || []).map((e) => String(e || "").trim().toLowerCase()).filter(Boolean));
  if (!set.size) return "";

  const match = senderOptions.find((s) => {
    const from = String(s.fromEmail || "").trim().toLowerCase();
    const reply = s.replyToEmail ? String(s.replyToEmail).trim().toLowerCase() : "";
    return (from && set.has(from)) || (reply && set.has(reply));
  });

  return match?.id || "";
}

type DraftMode = "auto" | "generated" | "manual";

type Draft = {
  subject: string;
  html: string;
  bodyText: string;
};

export default function UserMailPanel() {
  const params = useSearchParams();
  const router = useRouter();
  const dispatch = useAppDispatch();

  const initialTemplateKey = params.get("template") ?? undefined;

  const [loading, setLoading] = useState(true);
  const [avviso, setAvviso] = useState<Avviso>(null);

  const [mailEnabled, setMailEnabled] = useState(true);
  const [canSend, setCanSend] = useState(false);
  const [role, setRole] = useState<string>("");

  const [templates, setTemplates] = useState<Array<MailTemplateLite & { eventAuto?: MailEventAutoConfig }>>([]);
  const [selectedKey, setSelectedKey] = useState<string | undefined>(initialTemplateKey);

  const [senderOptions, setSenderOptions] = useState<SenderOption[]>([]);
  const [defaultSenderIdentityId, setDefaultSenderIdentityId] = useState<string | undefined>(undefined);

  const [to, setTo] = useState("");
  const [senderIdentityId, setSenderIdentityId] = useState<string>("");

  const [recipientOpen, setRecipientOpen] = useState(false);
  const [pickedRecipient, setPickedRecipient] = useState<PickedRecipient | null>(null);

  const [vars, setVars] = useState<Record<string, any>>({ name: "Mario", message: "Ciao!" });

  const [draftMode, setDraftMode] = useState<DraftMode>("auto");
  const [draft, setDraft] = useState<Draft>({ subject: "", html: "", bodyText: "" });

  const [composing, setComposing] = useState(false);

  const selectedTemplate = useMemo(
    () => templates.find((t) => t.key === selectedKey) || null,
    [templates, selectedKey]
  );

  useEffect(() => {
    if (!avviso) return;
    const t = setTimeout(() => setAvviso(null), 4000);
    return () => clearTimeout(t);
  }, [avviso]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const data = await jsonFetch<BootstrapResponse>("/api/mail/bootstrap");

        setRole(data.role);
        setMailEnabled(!!data.mailEnabled);
        setCanSend(!!data.canSend);

        setTemplates(Array.isArray(data.templates) ? data.templates : []);
        setSenderOptions(Array.isArray(data.senderOptions) ? data.senderOptions : []);
        setDefaultSenderIdentityId(data.defaultSenderIdentityId);

        const initialKey = initialTemplateKey || data.templates?.[0]?.key;
        setSelectedKey((prev) => prev || initialKey);

        const firstSender = data.senderOptions?.[0]?.id || "";
        const initialSender = data.defaultSenderIdentityId || firstSender;
        setSenderIdentityId((prev) => prev || initialSender);
      } catch (e: any) {
        setAvviso({ tipo: "errore", testo: e?.message || "Errore bootstrap mail" });
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!selectedKey) return;
    const sp = new URLSearchParams(Array.from(params.entries()));
    sp.set("template", selectedKey);
    router.replace(`?${sp.toString()}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedKey]);

  useEffect(() => {
    setDraftMode("auto");
    setDraft({ subject: "", html: "", bodyText: "" });
  }, [selectedKey]);

  useEffect(() => {
    setDraftMode("auto");
    setDraft({ subject: "", html: "", bodyText: "" });
  }, [pickedRecipient?.id, pickedRecipient?.typeSlug]);

  useEffect(() => {
    if (!selectedKey) return;

    if (!mailEnabled) {
      setDraft({ subject: "", html: "", bodyText: "" });
      return;
    }

    const t = setTimeout(async () => {
      try {
        const res = await jsonFetch<PreviewResponse>("/api/mail/preview", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ templateKey: selectedKey, vars }),
        });

        if (draftMode !== "auto") return;

        const bodyText = htmlToText(res.html || "");
        setDraft({
          subject: res.subject || "",
          html: res.html || "",
          bodyText,
        });
      } catch {
        if (draftMode !== "auto") return;
        setDraft({ subject: "", html: "", bodyText: "" });
      }
    }, 350);

    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedKey, mailEnabled, vars, draftMode]);

  async function maybeCreateAutoEventoAfterSend() {
    const ev = selectedTemplate?.eventAuto;
    if (!ev?.enabled) return;
    const eventoType = String(ev.eventoType || "").trim();
    if (!eventoType) return;

    const preset = isPlainObject(ev.dataPreset) ? ev.dataPreset : {};
    const renderedData = renderPresetDeep(preset, vars);

    const startAt =
      ev.startAtSource === "var"
        ? toISODateOrNull(getByPath(vars, ev.startAtVarPath))
        : new Date().toISOString();

    const endAt =
      ev.endAtSource === "var"
        ? toISODateOrNull(getByPath(vars, ev.endAtVarPath))
        : null;

    const gruppoType = ev.gruppo?.gruppoType ? String(ev.gruppo.gruppoType).trim() : "";
    const gruppoId = ev.gruppo?.gruppoIdVarPath ? String(getByPath(vars, ev.gruppo.gruppoIdVarPath) || "").trim() : "";

    const partecipanti: any[] = [];
    const seen = new Set<string>();

    const roleP = ev.partecipante?.role ?? null;
    const statusP = ev.partecipante?.status ?? null;
    const quantityP = ev.partecipante?.quantity ?? null;
    const noteP = ev.partecipante?.note ?? null;

    const pushParticipant = (typeSlug: string, id: string) => {
      const t = String(typeSlug || "").trim();
      const i = String(id || "").trim();
      if (!t || !i) return;
      const k = `${t}:${i}`;
      if (seen.has(k)) return;
      seen.add(k);
      partecipanti.push({
        anagraficaType: t,
        anagraficaId: i,
        role: roleP,
        status: statusP,
        quantity: quantityP != null ? Number(quantityP) : null,
        note: noteP,
      });
    };

    if (pickedRecipient) {
      pushParticipant(pickedRecipient.typeSlug, pickedRecipient.id);
      for (const r of pickedRecipient.related || []) pushParticipant(r.typeSlug, r.id);
    } else {
      const pType = ev.partecipante?.anagraficaType ? String(ev.partecipante.anagraficaType).trim() : "";
      const pId = ev.partecipante?.anagraficaIdVarPath
        ? String(getByPath(vars, ev.partecipante.anagraficaIdVarPath) || "").trim()
        : "";
      if (pType && pId) pushParticipant(pType, pId);
    }

    const payload: any = {
      data: renderedData,
      timeKind: ev.timeKind,
      startAt: startAt,
      endAt: ev.timeKind === "point" ? null : endAt,
      allDay: !!ev.allDay,
      recurrence: null,
      partecipanti,
      gruppo: gruppoType && gruppoId ? { gruppoType, gruppoId } : null,
      visibilityRole: null,
    };

    try {
      await dispatch(createEvento({ type: eventoType, payload }) as any).unwrap();
      setAvviso({ tipo: "successo", testo: "Email inviata + evento creato automaticamente." });
    } catch (e: any) {
      setAvviso({ tipo: "errore", testo: e?.message || "Email inviata, ma creazione evento fallita." });
    }
  }

  async function onSend() {
    if (!mailEnabled) return setAvviso({ tipo: "errore", testo: "Sistema mail disabilitato." });
    if (!canSend) return setAvviso({ tipo: "errore", testo: "Il tuo ruolo non può inviare email." });
    if (!selectedKey) return setAvviso({ tipo: "errore", testo: "Seleziona un template." });

    const toEmail = to.trim();
    if (!toEmail) return setAvviso({ tipo: "errore", testo: "Inserisci un destinatario (To)." });

    const fallbackFirst = senderOptions?.[0]?.id || "";
    const finalSenderId = (senderIdentityId || defaultSenderIdentityId || fallbackFirst).trim();
    if (!finalSenderId) return setAvviso({ tipo: "errore", testo: "Manca un mittente configurato." });

    const subjectToSend = (draft.subject || "").trim();
    const htmlToSend = (draft.html || "").trim();

    if (!subjectToSend && !htmlToSend) {
      return setAvviso({ tipo: "errore", testo: "La bozza è vuota: genera o scrivi il contenuto prima di inviare." });
    }

    try {
      const r: any = await jsonFetch("/api/mail/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: toEmail,
          templateKey: selectedKey,
          vars,
          senderIdentityId: finalSenderId,
          subjectOverride: subjectToSend || undefined,
          htmlOverride: htmlToSend || undefined,
        }),
      });

      setAvviso({
        tipo: "successo",
        testo: r?.messageId ? `Email inviata. (id: ${r.messageId})` : "Email inviata.",
      });

      await maybeCreateAutoEventoAfterSend();
    } catch (e: any) {
      setAvviso({ tipo: "errore", testo: e?.message || "Errore invio email" });
    }
  }

  async function onCompose() {
    if (!selectedKey) return setAvviso({ tipo: "errore", testo: "Seleziona un template." });
    if (!mailEnabled) return setAvviso({ tipo: "errore", testo: "Sistema mail disabilitato." });

    setComposing(true);
    try {
      const res = await jsonFetch<ComposeResponse>("/api/mail/compose", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          templateKey: selectedKey,
          currentVars: vars,
          anagrafica: pickedRecipient ? { typeSlug: pickedRecipient.typeSlug, id: pickedRecipient.id } : undefined,
          userGoal: "",
          language: "it",
        }),
      });

      const mergedVars = { ...(vars || {}), ...(res?.suggestion?.vars || {}) };
      setVars(mergedVars);

      const newSubject = res?.rendered?.subject || "";
      const newHtml = res?.rendered?.html || "";
      const newBodyText = htmlToText(newHtml);

      setDraftMode("generated");
      setDraft({ subject: newSubject, html: newHtml, bodyText: newBodyText });

      setAvviso({ tipo: "successo", testo: "Bozza generata." });
    } catch (e: any) {
      setAvviso({ tipo: "errore", testo: e?.message || "Errore generazione bozza" });
    } finally {
      setComposing(false);
    }
  }

  function handlePickRecipient(p: PickedRecipient) {
    setPickedRecipient(p);

    const chosenEmail = (p.emails?.[0] || "").trim();
    if (chosenEmail) setTo(chosenEmail);

    const all = (p.allEmails && p.allEmails.length ? p.allEmails : p.emails) || [];
    const suggestedSenderId = suggestSenderIdFromEmails(all, senderOptions);
    if (suggestedSenderId) setSenderIdentityId(suggestedSenderId);

    setVars((prev) => ({
      ...(prev || {}),
      recipient: {
        scope: p.scope,
        email: chosenEmail || null,
        emailsAll: all,
      },
      anagrafica: {
        type: p.typeSlug,
        id: p.id,
        label: p.label,
        ...(p.data ? { data: p.data } : {}),
        ...(p.related ? { related: p.related } : {}),
      },
    }));

    setAvviso({ tipo: "successo", testo: "Destinatario selezionato da anagrafica." });
  }

  if (loading) {
    return (
      <div className="rounded-[10px] border border-stroke bg-white p-4 shadow-1 dark:border-dark-3 dark:bg-gray-dark dark:shadow-card">
        <div className="animate-pulse space-y-3">
          <div className="h-6 w-72 rounded bg-gray-2 dark:bg-dark-2" />
          <div className="h-24 rounded bg-gray-2 dark:bg-dark-2" />
          <div className="h-24 rounded bg-gray-2 dark:bg-dark-2" />
        </div>
      </div>
    );
  }

  const recipientPill = pickedRecipient
    ? { label: pickedRecipient.label, meta: `${pickedRecipient.typeSlug} · ${pickedRecipient.id}` }
    : null;

  const disabledComposer = !mailEnabled || !canSend || !selectedKey;
  const hardDisabledCtas = disabledComposer || composing;

  return (
    <div className="w-full rounded-[10px] bg-white shadow-1 dark:bg-gray-dark dark:shadow-card">
      <div className="flex items-center justify-between border-b border-stroke px-4 py-3 dark:border-dark-3">
        <div className="min-w-0">
          <h3 className="truncate text-lg font-semibold text-dark dark:text-white">
            {selectedTemplate?.name ?? "Template Email"}
          </h3>

          <div className="mt-0.5 text-xs text-dark/60 dark:text-white/60">
            Ruolo: <span className="font-mono">{role || "—"}</span> ·{" "}
            <span className={cn("font-semibold", mailEnabled ? "text-emerald-600" : "text-red-600")}>
              {mailEnabled ? "MAIL ON" : "MAIL OFF"}
            </span>{" "}
            ·{" "}
            <span className={cn("font-semibold", canSend ? "text-emerald-600" : "text-red-600")}>
              {canSend ? "PUÒ INVIARE" : "NON PUÒ INVIARE"}
            </span>
            {selectedTemplate?.eventAuto?.enabled ? (
              <span className="ml-2 rounded-full bg-blue-100 px-2 py-0.5 text-[11px] font-semibold text-blue-800 dark:bg-blue-900/30 dark:text-blue-100">
                AUTOEVENTO ON
              </span>
            ) : null}
            {draftMode !== "auto" ? (
              <span className="ml-2 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-100">
                {draftMode === "generated" ? "BOZZA GENERATA" : "MODIFICA MANUALE"}
              </span>
            ) : null}
          </div>
        </div>
      </div>

      <div className="p-4">
        <InlineAlert avviso={avviso} onClose={() => setAvviso(null)} />

        <div className="flex min-h-[56vh]">
          <section className="flex min-h-[56vh] flex-1 flex-col gap-4">
            <MailComposer
              disabled={disabledComposer}
              to={to}
              onChangeTo={(v) => {
                setDraftMode("auto");
                setDraft({ subject: "", html: "", bodyText: "" });
                setTo(v);
              }}
              senderOptions={senderOptions}
              senderIdentityId={senderIdentityId}
              onChangeSenderIdentityId={setSenderIdentityId}
              onOpenRecipientPicker={() => setRecipientOpen(true)}
              recipientPill={recipientPill}
              onClearRecipient={() => {
                setPickedRecipient(null);
                setDraftMode("auto");
                setDraft({ subject: "", html: "", bodyText: "" });
              }}
            />

            <MailPreview
              templateKey={selectedTemplate?.key || ""}
              subject={draft.subject}
              bodyText={draft.bodyText}
              disabled={!mailEnabled}
              hint={!selectedKey ? "Seleziona un template a destra." : "Anteprima generata automaticamente."}
              onChangeSubject={(v) => {
                setDraftMode("manual");
                setDraft((prev) => ({ ...prev, subject: v }));
              }}
              onChangeBodyText={(v) => {
                setDraftMode("manual");
                setDraft((prev) => ({
                  ...prev,
                  bodyText: v,
                  html: textToSimpleHtml(v),
                }));
              }}
            />

            <div className="rounded-lg border border-stroke p-4 dark:border-dark-3">
              <div className="grid gap-2 sm:grid-cols-2">
                <button
                  onClick={onCompose}
                  disabled={hardDisabledCtas}
                  className={cn(
                    "rounded-2xl border-2 px-5 py-3 text-sm font-bold",
                    "border-primary text-primary hover:bg-primary/10",
                    "dark:border-red-400 dark:text-red-400 dark:hover:bg-red-400/10",
                    hardDisabledCtas && "opacity-60 cursor-not-allowed"
                  )}
                  title="Genera automaticamente il corpo email usando i dati disponibili"
                >
                  {composing ? "Genero…" : "Genera bozza"}
                </button>

                <button
                  onClick={onSend}
                  disabled={hardDisabledCtas}
                  className={cn(
                    "rounded-2xl px-5 py-3 text-sm font-bold text-white hover:opacity-90",
                    hardDisabledCtas ? "bg-gray-400 cursor-not-allowed" : "bg-primary"
                  )}
                >
                  Invia
                </button>
              </div>

              <div className="mt-2 text-[11px] text-dark/60 dark:text-white/60">
                La mail inviata sarà esattamente questa bozza (anche se modificata a mano).
              </div>
            </div>
          </section>

          <TemplateList
            items={templates as any}
            selectedKey={selectedKey}
            onSelect={(k) => {
              setSelectedKey(k);
              setDraftMode("auto");
              setDraft({ subject: "", html: "", bodyText: "" });
            }}
            className="hidden lg:block"
          />
        </div>
      </div>

      <RecipientPickerModal
        open={recipientOpen}
        onClose={() => setRecipientOpen(false)}
        onPick={(p: any) => {
          setDraftMode("auto");
          setDraft({ subject: "", html: "", bodyText: "" });
          handlePickRecipient(p as PickedRecipient);
        }}
      />
    </div>
  );
}
