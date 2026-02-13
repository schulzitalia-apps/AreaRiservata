"use client";

import { useEffect, useMemo, useState } from "react";
import type { WhiteboardParticipant } from "../types";

import { apiClient } from "@/components/Store/api/client";
import { getAnagraficaDef } from "@/config/anagrafiche.registry";

/* ----------------------- UTILS (da EventoPartecipazionePills) ----------------------- */

const shortId = (id: string, keep = 14) => (id.length > keep ? `${id.slice(0, keep)}…` : id);

function unwrapApiPayload(x: any): any {
  if (!x) return null;
  return x.anagrafica ?? x.aula ?? x.evento ?? x.item ?? x.data ?? x;
}

function getDataRecord(obj: any): Record<string, any> {
  if (!obj) return {};
  return (obj.data && typeof obj.data === "object" ? obj.data : obj) as Record<string, any>;
}

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

function looksMissingName(p: WhiteboardParticipant) {
  const t = String(p.anagraficaType ?? "").trim();
  const id = String(p.anagraficaId ?? "").trim();
  const dn = String(p.displayName ?? "").trim().toLowerCase();

  if (!t || !id) return false;
  if (!dn) return true;
  if (dn === "(senza nome)") return true;
  if (dn === `${t}:${id}`.toLowerCase()) return true;

  return false;
}

/* ----------------------- HOOK ----------------------- */

export function useParticipantNameCache(participantsRaw: WhiteboardParticipant[]) {
  const [nameCache, setNameCache] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  const needKeys = useMemo(() => {
    const out = new Set<string>();

    for (const p of participantsRaw) {
      if (!looksMissingName(p)) continue;

      const t = String(p.anagraficaType ?? "").trim();
      const id = String(p.anagraficaId ?? "").trim();
      if (!t || !id) continue;

      out.add(`anag:${t}:${id}`);
    }

    return Array.from(out);
  }, [participantsRaw]);

  useEffect(() => {
    if (!needKeys.length) return;

    let cancelled = false;

    (async () => {
      const missing = needKeys.filter((k) => !nameCache[k]);
      if (!missing.length) return;

      setLoading(true);
      try {
        const next: Record<string, string> = {};

        await Promise.all(
          missing.map(async (k) => {
            if (!k.startsWith("anag:")) return;
            const [, t, id] = k.split(":");

            const res = await tryGet([
              `/api/anagrafiche/${t}/${id}`,
              `/api/${t}/${id}`,
            ]);

            const unwrapped = unwrapApiPayload(res);

            const def = getAnagraficaDef(t);
            const previewTitleKeys = (def?.preview?.title ?? []) as unknown as string[] | undefined;

            const title =
              buildPreviewTitle(previewTitleKeys, unwrapped) ||
              buildFallbackLabel(unwrapped) ||
              shortId(id, 14);

            next[k] = title;
          }),
        );

        if (cancelled) return;
        if (Object.keys(next).length) setNameCache((prev) => ({ ...prev, ...next }));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
    // stesso pattern del pills: deps stabile, niente nameCache nei deps
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [needKeys.join("|")]);

  const participants: WhiteboardParticipant[] = useMemo(() => {
    const out = participantsRaw.map((p) => {
      const k = `anag:${p.anagraficaType}:${p.anagraficaId}`;
      const resolved = nameCache[k];
      return resolved && resolved.trim() ? { ...p, displayName: resolved } : p;
    });

    out.sort((a, b) => a.displayName.localeCompare(b.displayName));
    return out;
  }, [participantsRaw, nameCache]);

  return { participants, nameCache, loading };
}
