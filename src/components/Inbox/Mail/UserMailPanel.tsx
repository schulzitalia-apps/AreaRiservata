"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { cn } from "@/server-utils/lib/utils";

import { useAppDispatch } from "@/components/Store/hooks";
import { createEvento } from "@/components/Store/slices/eventiSlice";

import TemplateList, { MailTemplateLite } from "./TemplateList";
import MailComposer, { SenderOption } from "./MailComposer";
import MailPreview from "./MailPreview";
import RecipientPickerModal, { PickedRecipient } from "./RecipientPickerModal";
import { buildRecipientVars, sanitizeVarsForCompose } from "./utils/mailContext";

type Avviso = { tipo: "successo" | "errore" | "info"; testo: string } | null;

function InlineAlert({ avviso, onClose }: { avviso: Avviso; onClose: () => void }) {
  if (!avviso) return null;

  const tone =
    avviso.tipo === "successo"
      ? "border-green-500 bg-green-50 text-green-800 dark:border-green-400 dark:bg-green-900/30 dark:text-green-100"
      : avviso.tipo === "errore"
        ? "border-red-500 bg-red-50 text-red-800 dark:border-red-400 dark:bg-red-900/30 dark:text-red-100"
        : "border-blue-500 bg-blue-50 text-blue-800 dark:border-blue-400 dark:bg-blue-900/30 dark:text-blue-100";

  return (
    <div className={`mb-4 flex items-start gap-3 rounded-2xl border px-4 py-3 ${tone}`}>
      <p className="text-sm leading-6">{avviso.testo}</p>
      <button
        onClick={onClose}
        className="ml-auto rounded px-1.5 text-xs font-bold uppercase tracking-wide hover:opacity-80"
        aria-label="Chiudi notifica"
      >
        Chiudi
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

    return (doc.body.textContent || "")
      .replace(/\r/g, "")
      .replace(/[ \t]+\n/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  } catch {
    return raw.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  }
}

function textToSimpleHtml(text: string): string {
  const t = (text || "").replace(/\r/g, "").trim();
  if (!t) return "";

  const escape = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  const paragraphs = t.split(/\n{2,}/g).map((p) => p.trim()).filter(Boolean);
  return paragraphs
    .map((p) => `<p>${escape(p).replace(/\n/g, "<br/>")}</p>`)
    .join("\n");
}

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
  if (x instanceof Date) return Number.isFinite(x.getTime()) ? x.toISOString() : null;
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
  rendered: {
    subject: string;
    html: string;
  };
};

type CcRecipient = {
  key: string;
  sourceKind: "ANAGRAFICA" | "AULA";
  typeSlug: string;
  id: string;
  label: string;
  email: string;
};

function suggestSenderIdFromEmails(emails: string[], senderOptions: SenderOption[]) {
  const set = new Set(
    (emails || []).map((e) => String(e || "").trim().toLowerCase()).filter(Boolean),
  );
  if (!set.size) return "";

  const match = senderOptions.find((s) => {
    const from = String(s.fromEmail || "").trim().toLowerCase();
    const reply = s.replyToEmail ? String(s.replyToEmail).trim().toLowerCase() : "";
    return (from && set.has(from)) || (reply && set.has(reply));
  });

  return match?.id || "";
}

type DraftMode = "auto" | "generated" | "manual";
type Draft = { subject: string; html: string; bodyText: string };

export default function UserMailPanel() {
  const params = useSearchParams();
  const router = useRouter();
  const dispatch = useAppDispatch();

  const initialTemplateKey = params.get("template") ?? undefined;

  const [loading, setLoading] = useState(true);
  const [avviso, setAvviso] = useState<Avviso>(null);
  const [mailEnabled, setMailEnabled] = useState(true);
  const [canSend, setCanSend] = useState(false);
  const [templates, setTemplates] = useState<Array<MailTemplateLite & { eventAuto?: MailEventAutoConfig }>>([]);
  const [selectedKey, setSelectedKey] = useState<string | undefined>(initialTemplateKey);
  const [senderOptions, setSenderOptions] = useState<SenderOption[]>([]);
  const [defaultSenderIdentityId, setDefaultSenderIdentityId] = useState<string | undefined>(undefined);
  const [to, setTo] = useState("");
  const [senderIdentityId, setSenderIdentityId] = useState<string>("");
  const [primaryRecipientOpen, setPrimaryRecipientOpen] = useState(false);
  const [ccRecipientOpen, setCcRecipientOpen] = useState(false);
  const [pickedRecipient, setPickedRecipient] = useState<PickedRecipient | null>(null);
  const [ccRecipients, setCcRecipients] = useState<CcRecipient[]>([]);
  const [vars, setVars] = useState<Record<string, any>>({});
  const [draftMode, setDraftMode] = useState<DraftMode>("auto");
  const [draft, setDraft] = useState<Draft>({ subject: "", html: "", bodyText: "" });
  const [composing, setComposing] = useState(false);

  const draftRef = useRef(draft);
  useEffect(() => {
    draftRef.current = draft;
  }, [draft]);

  const selectedTemplate = useMemo(
    () => templates.find((t) => t.key === selectedKey) || null,
    [templates, selectedKey],
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
  }, [initialTemplateKey]);

  useEffect(() => {
    if (!selectedKey) return;
    const sp = new URLSearchParams(Array.from(params.entries()));
    sp.set("template", selectedKey);
    router.replace(`?${sp.toString()}`);
  }, [params, router, selectedKey]);

  useEffect(() => {
    setDraftMode("auto");
    setDraft({ subject: "", html: "", bodyText: "" });
  }, [selectedKey, pickedRecipient?.id, pickedRecipient?.typeSlug]);

  useEffect(() => {
    if (!selectedKey || !mailEnabled) {
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
        setDraft({
          subject: res.subject || "",
          html: res.html || "",
          bodyText: htmlToText(res.html || ""),
        });
      } catch {
        if (draftMode !== "auto") return;
        setDraft({ subject: "", html: "", bodyText: "" });
      }
    }, 350);

    return () => clearTimeout(t);
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
    const gruppoId = ev.gruppo?.gruppoIdVarPath
      ? String(getByPath(vars, ev.gruppo.gruppoIdVarPath) || "").trim()
      : "";

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
      const pType = ev.partecipante?.anagraficaType
        ? String(ev.partecipante.anagraficaType).trim()
        : "";
      const pId = ev.partecipante?.anagraficaIdVarPath
        ? String(getByPath(vars, ev.partecipante.anagraficaIdVarPath) || "").trim()
        : "";
      if (pType && pId) pushParticipant(pType, pId);
    }

    const payload: any = {
      data: renderedData,
      timeKind: ev.timeKind,
      startAt,
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
      setAvviso({
        tipo: "errore",
        testo: e?.message || "Email inviata, ma creazione evento fallita.",
      });
    }
  }

  async function onSend() {
    if (!mailEnabled) return setAvviso({ tipo: "errore", testo: "Sistema mail disabilitato." });
    if (!canSend) return setAvviso({ tipo: "errore", testo: "Invio non consentito per il tuo ruolo." });
    if (!selectedKey) return setAvviso({ tipo: "errore", testo: "Seleziona un template." });

    const toEmail = to.trim();
    if (!toEmail) return setAvviso({ tipo: "errore", testo: "Inserisci un destinatario." });

    const fallbackFirst = senderOptions?.[0]?.id || "";
    const finalSenderId = (senderIdentityId || defaultSenderIdentityId || fallbackFirst).trim();
    if (!finalSenderId) return setAvviso({ tipo: "errore", testo: "Manca un mittente configurato." });

    const subjectToSend = (draftRef.current.subject || "").trim();
    const htmlToSend = (draftRef.current.html || "").trim();
    if (!subjectToSend && !htmlToSend) {
      return setAvviso({ tipo: "errore", testo: "La bozza e vuota." });
    }

    try {
      const r: any = await jsonFetch("/api/mail/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: toEmail,
          cc: ccRecipients.map((item) => item.email),
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
          currentVars: sanitizeVarsForCompose(vars),
          anagrafica: pickedRecipient
            ? { typeSlug: pickedRecipient.typeSlug, id: pickedRecipient.id }
            : undefined,
          userGoal: "",
          language: "it",
        }),
      });

      const newHtml = res?.rendered?.html || "";
      setDraft({
        subject: res?.rendered?.subject || "",
        html: newHtml,
        bodyText: htmlToText(newHtml),
      });
      setDraftMode("generated");
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
      ...buildRecipientVars({
        ...p,
        scope: "ANAGRAFICA",
        emails: chosenEmail ? [chosenEmail] : p.emails,
        allEmails: all,
      }),
    }));
  }

  function handleAddCcRecipient(p: PickedRecipient) {
    const email = String(p.emails?.[0] || "").trim().toLowerCase();
    if (!email) {
      setAvviso({ tipo: "errore", testo: "Il record selezionato non ha email utilizzabili." });
      return;
    }

    setCcRecipients((prev) => {
      const key = `${p.sourceKind}:${p.typeSlug}:${p.id}:${email}`;
      if (prev.some((item) => item.key === key || item.email === email)) return prev;
      return [
        ...prev,
        {
          key,
          sourceKind: p.sourceKind,
          typeSlug: p.typeSlug,
          id: p.id,
          label: p.label,
          email,
        },
      ];
    });
  }

  if (loading) {
    return (
      <div className="rounded-[28px] border border-stroke/80 bg-white p-5 shadow-1 dark:border-dark-3/80 dark:bg-gray-dark dark:shadow-card">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-72 rounded bg-gray-2 dark:bg-dark-2" />
          <div className="h-16 rounded-2xl bg-gray-2 dark:bg-dark-2" />
          <div className="h-80 rounded-2xl bg-gray-2 dark:bg-dark-2" />
        </div>
      </div>
    );
  }

  const recipientPill = pickedRecipient
    ? { label: pickedRecipient.label, meta: pickedRecipient.typeSlug }
    : null;

  const disabledComposer = !mailEnabled || !canSend || !selectedKey;
  const hardDisabledCtas = disabledComposer || composing;

  return (
    <div className="w-full overflow-hidden rounded-[28px] border border-stroke/80 bg-white shadow-1 dark:border-dark-3/80 dark:bg-gray-dark dark:shadow-card">
      <div className="border-b border-stroke/80 px-5 py-5 dark:border-dark-3/80">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-2xl font-bold text-dark dark:text-white">Composizione mail</h2>
            <div className="mt-1 text-sm text-dark/60 dark:text-white/60">
              Seleziona un template, scegli il destinatario e modifica liberamente il testo.
            </div>
          </div>

          <div className="flex items-center gap-2">
            {selectedTemplate ? (
              <span className="rounded-full border border-stroke px-3 py-1 text-xs font-semibold text-dark/70 dark:border-dark-3 dark:text-white/70">
                {selectedTemplate.name}
              </span>
            ) : null}
            {!mailEnabled ? (
              <span className="rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-700 dark:bg-red-500/15 dark:text-red-200">
                Mail off
              </span>
            ) : null}
          </div>
        </div>
      </div>

      <div className="px-5 pb-5 pt-4">
        <InlineAlert avviso={avviso} onClose={() => setAvviso(null)} />

        <div className="flex min-h-[60vh] gap-0">
          <section className="flex flex-1 flex-col gap-4 pr-0 lg:pr-5">
            <MailComposer
              disabled={disabledComposer}
              to={to}
              onChangeTo={(v) => {
                setDraftMode("auto");
                setDraft({ subject: "", html: "", bodyText: "" });
                setTo(v);
              }}
              ccRecipients={ccRecipients.map((item) => ({
                key: item.key,
                label: item.label,
                email: item.email,
                meta: item.sourceKind === "AULA" ? `Aula - ${item.typeSlug}` : `Anagrafica - ${item.typeSlug}`,
              }))}
              onOpenCcPicker={() => setCcRecipientOpen(true)}
              onRemoveCcRecipient={(key) => {
                setCcRecipients((prev) => prev.filter((item) => item.key !== key));
              }}
              senderOptions={senderOptions}
              senderIdentityId={senderIdentityId}
              onChangeSenderIdentityId={setSenderIdentityId}
              onOpenRecipientPicker={() => setPrimaryRecipientOpen(true)}
              recipientPill={recipientPill}
              onClearRecipient={() => {
                setPickedRecipient(null);
                setVars((prev) => {
                  const next = { ...(prev || {}) };
                  delete next.recipient;
                  delete next.anagrafica;
                  return next;
                });
                setDraftMode("auto");
                setDraft({ subject: "", html: "", bodyText: "" });
              }}
            />

            <MailPreview
              templateKey={selectedTemplate?.key || ""}
              subject={draft.subject}
              bodyText={draft.bodyText}
              disabled={!mailEnabled}
              hint={!selectedKey ? "Seleziona un template a destra." : "Il testo del template comparira qui automaticamente."}
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

            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-stroke/80 px-4 py-4 dark:border-dark-3/80">
              <div className="text-xs text-dark/60 dark:text-white/60">
                La mail inviata usera esattamente questo testo.
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  onClick={onCompose}
                  disabled={hardDisabledCtas}
                  className={cn(
                    "rounded-xl border px-4 py-2 text-sm font-semibold transition",
                    "border-primary/30 text-primary hover:bg-primary/5",
                    hardDisabledCtas && "cursor-not-allowed opacity-60",
                  )}
                >
                  {composing ? "Genero..." : "Genera bozza"}
                </button>

                <button
                  onClick={onSend}
                  disabled={hardDisabledCtas}
                  className={cn(
                    "rounded-xl px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90",
                    hardDisabledCtas ? "cursor-not-allowed bg-gray-400" : "bg-primary",
                  )}
                >
                  Invia
                </button>
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
        open={primaryRecipientOpen}
        onClose={() => setPrimaryRecipientOpen(false)}
        onPick={(p: any) => {
          setDraftMode("auto");
          setDraft({ subject: "", html: "", bodyText: "" });
          handlePickRecipient(p as PickedRecipient);
        }}
        mode="primary"
        allowAule={false}
      />

      <RecipientPickerModal
        open={ccRecipientOpen}
        onClose={() => setCcRecipientOpen(false)}
        onPick={(p: any) => {
          handleAddCcRecipient(p as PickedRecipient);
        }}
        mode="cc"
        allowAule={true}
      />
    </div>
  );
}
