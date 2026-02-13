"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Building2, UserRound, UsersRound } from "lucide-react";

import { InfoPill } from "@/components/AtlasModuli/common/InfoPill";
import type {
  EventoFull,
  EventoPartecipanteView,
} from "@/components/Store/models/eventi";

import { apiClient } from "@/components/Store/api/client";
import { getAnagraficaDef } from "@/config/anagrafiche.registry";
import { getAulaDef } from "@/config/aule.registry";

type Tone = "success" | "rose" | "warning" | "info" | "neutral";

type Props = {
  evento: EventoFull | null | undefined;

  /** servono per link tipo edit */
  eventoType: string;
  eventoId: string;

  /** massimo pills partecipanti mostrate */
  maxPartecipanti?: number;

  /** se vuoi override delle route */
  buildAnagraficaHref?: (p: EventoPartecipanteView) => string;
  buildGruppoHref?: (gruppoType: string, gruppoId: string) => string;
};

const shortId = (id: string, keep = 10) =>
  id.length > keep ? `${id.slice(0, keep)}…` : id;

function hash(str: string) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0;
  return Math.abs(h);
}

const PALETTE: Tone[] = ["warning", "rose", "success", "info"];

function toneForKey(key: string): Tone {
  return PALETTE[hash(key) % PALETTE.length] ?? "success";
}

/**
 * Estrae l’oggetto “utile” da risposte API con wrapper diversi
 * (es. { anagrafica }, { aula }, { item }, ecc.)
 */
function unwrapApiPayload(x: any): any {
  if (!x) return null;
  return x.anagrafica ?? x.aula ?? x.evento ?? x.item ?? x.data ?? x;
}

/** prende il record “data” se presente, altrimenti l’oggetto stesso */
function getDataRecord(obj: any): Record<string, any> {
  if (!obj) return {};
  return (obj.data && typeof obj.data === "object" ? obj.data : obj) as Record<
    string,
    any
  >;
}

/**
 * Costruisce il “titolo preview” in modo GENERICO:
 * - usa preview.title[] dal def
 * - legge i valori da obj.data[k] (o fallback obj[k])
 * - join con spazio
 */
function buildPreviewTitle(defPreviewTitle: string[] | undefined, obj: any) {
  const record = getDataRecord(obj);
  const keys = Array.isArray(defPreviewTitle) ? defPreviewTitle : [];

  const vals = keys
    .map((k) => {
      const v = record?.[k] ?? (obj ? obj[k] : undefined);
      if (v === null || v === undefined) return "";
      if (typeof v === "string") return v.trim();
      return String(v);
    })
    .filter(Boolean);

  return vals.join(" ").trim();
}

/** fallback “ragionevole” se non c’è preview.title o è vuoto */
function buildFallbackLabel(obj: any) {
  if (!obj) return null;

  const direct =
    obj.displayName ??
    obj.label ??
    obj.title ??
    obj.name ??
    obj?.data?.displayName ??
    obj?.data?.label ??
    obj?.data?.title ??
    obj?.data?.name;

  if (typeof direct === "string" && direct.trim()) return direct.trim();
  return null;
}

async function tryGet<T = any>(urls: string[]): Promise<T | null> {
  for (const url of urls) {
    try {
      const res = await apiClient.get<any>(url);
      return res as T;
    } catch {
      // prova URL successivo
    }
  }
  return null;
}

function ClickablePill({
                         href,
                         tone,
                         icon,
                         title,
                         children,
                       }: {
  href: string;
  tone: Tone;
  icon?: React.ReactNode;
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <Link href={href} className="group inline-flex" title={title}>
      {/* cast any per compatibilità con eventuale typing stretto di InfoPill */}
      <InfoPill tone={tone as any}>
        <span className="inline-flex items-center gap-1.5">
          {icon}
          <span className="group-hover:underline underline-offset-2">
            {children}
          </span>
        </span>
      </InfoPill>
    </Link>
  );
}

export default function EventoPartecipazionePills({
                                                    evento,
                                                    eventoType,
                                                    eventoId,
                                                    maxPartecipanti = 8,
                                                    buildAnagraficaHref,
                                                    buildGruppoHref,
                                                  }: Props) {
  const [nameCache, setNameCache] = useState<Record<string, string>>({});

  const anagHref =
    buildAnagraficaHref ??
    ((p: EventoPartecipanteView) =>
      `/anagrafiche/${p.anagraficaType}/${p.anagraficaId}`);

  const grpHref =
    buildGruppoHref ??
    ((t: string, id: string) => `/aule/${t}/${id}`);

  const partecipanti = Array.isArray(evento?.partecipanti)
    ? (evento!.partecipanti as EventoPartecipanteView[])
    : [];

  const gruppoType = evento?.gruppo?.gruppoType ?? null;
  const gruppoId = evento?.gruppo?.gruppoId ?? null;

  const needKeys = useMemo(() => {
    const out = new Set<string>();

    for (const p of partecipanti) {
      out.add(`anag:${p.anagraficaType}:${p.anagraficaId}`);
    }
    if (gruppoType && gruppoId) {
      out.add(`grp:${gruppoType}:${gruppoId}`);
    }

    return Array.from(out);
  }, [partecipanti, gruppoType, gruppoId]);

  useEffect(() => {
    if (!needKeys.length) return;

    let cancelled = false;

    (async () => {
      const missing = needKeys.filter((k) => !nameCache[k]);
      if (!missing.length) return;

      const next: Record<string, string> = {};

      await Promise.all(
        missing.map(async (k) => {
          // ANAGRAFICHE
          if (k.startsWith("anag:")) {
            const [, t, id] = k.split(":");

            const res = await tryGet([
              `/api/anagrafiche/${t}/${id}`,
              `/api/${t}/${id}`, // fallback se lo slug è già “root”
            ]);

            const unwrapped = unwrapApiPayload(res);

            // ✅ usa SEMPRE preview.title del tipo
            const def = getAnagraficaDef(t);
            const previewTitleKeys = def?.preview?.title as any as string[] | undefined;

            const title =
              buildPreviewTitle(previewTitleKeys, unwrapped) ||
              buildFallbackLabel(unwrapped) ||
              shortId(id, 14);

            next[k] = title;
          }

          // GRUPPO / AULA
          if (k.startsWith("grp:")) {
            const [, t, id] = k.split(":");

            const res = await tryGet([
              `/api/aule/${t}/${id}`,
              `/api/${t}/${id}`,
            ]);

            const unwrapped = unwrapApiPayload(res);

            // se anche le aule hanno preview.title in registry, usiamolo
            const aulaDef: any = getAulaDef(t);
            const aulaPreviewKeys: string[] | undefined =
              aulaDef?.preview?.title ?? aulaDef?.previewTitle ?? undefined;

            const title =
              buildPreviewTitle(aulaPreviewKeys, unwrapped) ||
              buildFallbackLabel(unwrapped) ||
              shortId(id, 14);

            next[k] = title;
          }
        }),
      );

      if (cancelled) return;
      if (Object.keys(next).length) {
        setNameCache((prev) => ({ ...prev, ...next }));
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [needKeys.join("|")]);

  if (!evento) return null;
  if (!gruppoType && !partecipanti.length) return null;

  const shown = partecipanti.slice(0, maxPartecipanti);
  const remaining = Math.max(0, partecipanti.length - shown.length);

  return (
    <>
      {/* GRUPPO / AULA */}
      {gruppoType && gruppoId && (
        <ClickablePill
          href={grpHref(gruppoType, gruppoId)}
          tone={toneForKey(`grp:${gruppoType}`)}
          icon={<Building2 size={14} />}
          title={`${gruppoType}:${gruppoId}`}
        >
          {getAulaDef(gruppoType).label}:{" "}
          {nameCache[`grp:${gruppoType}:${gruppoId}`] ?? shortId(gruppoId, 12)}
        </ClickablePill>
      )}

      {/* PARTECIPANTI */}
      {shown.map((p) => {
        const typeLabel = getAnagraficaDef(p.anagraficaType).label;

        const cacheKey = `anag:${p.anagraficaType}:${p.anagraficaId}`;
        const resolvedTitle = nameCache[cacheKey] ?? shortId(p.anagraficaId, 12);

        const tone = toneForKey(`anag:${p.anagraficaType}`);

        return (
          <ClickablePill
            key={`${p.anagraficaType}:${p.anagraficaId}`}
            href={anagHref(p)}
            tone={tone}
            icon={<UserRound size={14} />}
            title={`${p.anagraficaType}:${p.anagraficaId}`}
          >
            {typeLabel}: {resolvedTitle}
          </ClickablePill>
        );
      })}

      {/* +N altri -> edit */}
      {remaining > 0 && (
        <ClickablePill
          href={`/eventi/${eventoType}/${eventoId}/edit`}
          tone="warning"
          icon={<UsersRound size={14} />}
          title="Apri modifica per vedere tutti i partecipanti"
        >
          +{remaining} altri
        </ClickablePill>
      )}
    </>
  );
}
