"use client";

import { useEffect, useMemo, useState } from "react";
import { anagraficheService } from "@/components/Store/services/anagraficheService";
import { extractRefId, pickFirst, safeNumber } from "./PreventiviUtils";

export type PreventivoTotals = {
  imponibile: number;
  iva: number;
  totale: number;
  righe: number;
};

export type PreventivoListItem = {
  id: string;
  displayName: string;
  ownerName?: string;
  visibilityRole?: string | null;
  data: Record<string, any>;
  clienteLabel?: string | null;

  // ✅ lo usiamo per render + filtro
  statoPreventivo?: string | null;

  totals: PreventivoTotals;
};

export type UsePreventiviListResult = {
  items: PreventivoListItem[];
  status: "idle" | "loading" | "success" | "error";
  totalItems: number;
  totalPages: number;
  error?: string;
};

type Args = {
  query?: string;
  stato?: string;
  page: number;
  pageSize: number;
};

const PREVENTIVI_TYPE = "preventivi";
const RIGHE_TYPE = "righe-preventivo";
const CLIENTI_SLUG = "clienti";
const CLIENTI_PREVIEW_FIELD = "ragioneSociale";

// tentiamo anche alternative, ma la primaria deve essere questa
const STATO_FIELD_PRIMARY = "statoPreventivo";
// fallback “best effort” se in qualche def è diverso
const STATO_FIELD_FALLBACKS = ["stato", "stato_preventivo"] as const;

function normalizeStato(v: any): string {
  if (v == null) return "";
  if (typeof v === "string" || typeof v === "number") return String(v).trim();
  // se arriva wrapper/oggetto, prova a scavare
  const picked = pickFirst(v, ["value", "id", "_id", "label", "name"] as any);
  return picked != null ? String(picked).trim() : "";
}

export function usePreventiviList({ query, stato, page, pageSize }: Args): UsePreventiviListResult {
  const [status, setStatus] = useState<UsePreventiviListResult["status"]>("idle");
  const [items, setItems] = useState<PreventivoListItem[]>([]);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [error, setError] = useState<string | undefined>(undefined);

  const q = useMemo(() => (query ?? "").trim(), [query]);
  const st = useMemo(() => (stato ?? "").trim(), [stato]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setStatus("loading");
      setError(undefined);

      try {
        // 1) list preventivi (preview)
        const res = await anagraficheService.list({
          type: PREVENTIVI_TYPE,
          query: q || undefined,
          page,
          pageSize,
        });

        if (cancelled) return;

        const rawItems: any[] = (res as any)?.items ?? [];
        const total = (res as any)?.total ?? rawItems.length ?? 0;
        const tPages = Math.max(1, Math.ceil((total || 0) / pageSize));

        const pageIds = rawItems.map((p: any) => String(p.id));

        // 2) ✅ stato: NON fidarti del preview -> getFieldValues sui preventivi della pagina
        let statoById: Record<string, any> = {};

        if (pageIds.length > 0) {
          // prova primary + fallback (senza helper, best effort)
          const fieldCalls = [
            anagraficheService
              .getFieldValues({ targetSlug: PREVENTIVI_TYPE, field: STATO_FIELD_PRIMARY, ids: pageIds })
              .then((m) => ({ field: STATO_FIELD_PRIMARY, map: (m as any) ?? {} }))
              .catch(() => ({ field: STATO_FIELD_PRIMARY, map: {} })),
            ...STATO_FIELD_FALLBACKS.map((f) =>
              anagraficheService
                .getFieldValues({ targetSlug: PREVENTIVI_TYPE, field: f, ids: pageIds })
                .then((m) => ({ field: f, map: (m as any) ?? {} }))
                .catch(() => ({ field: f, map: {} })),
            ),
          ];

          const results = await Promise.all(fieldCalls);
          if (cancelled) return;

          // scegli il primo mapping che restituisce almeno un valore “sensato”
          const pickMap =
            results.find((r) => {
              const vals = Object.values(r.map ?? {});
              return vals.some((v) => normalizeStato(v).length > 0);
            })?.map ?? {};

          statoById = pickMap;
        }

        // 3) filtro stato (ora che lo hai davvero)
        const filteredPreventivi = st
          ? rawItems.filter((p: any) => {
            const id = String(p.id);
            const statoReal = normalizeStato(statoById[id]);
            return statoReal === st;
          })
          : rawItems;

        const preventivoIds = filteredPreventivi.map((p: any) => String(p.id));
        const idSet = new Set(preventivoIds);

        // 4) righe -> totals per i preventivi filtrati
        const righeRes = await anagraficheService.list({
          type: RIGHE_TYPE,
          page: 1,
          pageSize: 5000,
        });

        if (cancelled) return;

        const righeItems: any[] = (righeRes as any)?.items ?? [];

        const totalsByPreventivoId: Record<string, PreventivoTotals> = {};
        preventivoIds.forEach((id) => {
          totalsByPreventivoId[id] = { imponibile: 0, iva: 0, totale: 0, righe: 0 };
        });

        righeItems.forEach((r: any) => {
          const d = r?.data ?? {};
          const refId = extractRefId(d.preventivoRiferimento ?? d.preventivoId ?? d.preventivo);
          if (!refId) return;
          const rid = String(refId);
          if (!idSet.has(rid)) return;

          const totaleRiga = safeNumber(pickFirst(d, ["totaleRiga", "totale"]));
          totalsByPreventivoId[rid].imponibile += totaleRiga;
          totalsByPreventivoId[rid].righe += 1;
        });

        preventivoIds.forEach((id) => {
          const imp = totalsByPreventivoId[id]?.imponibile ?? 0;
          const iva = imp * 0.22;
          totalsByPreventivoId[id].iva = iva;
          totalsByPreventivoId[id].totale = imp + iva;
        });

        // 5) cliente label
        const clienteIds = Array.from(
          new Set(
            filteredPreventivi
              .map((p: any) => p?.data?.clientePreventivo)
              .filter(Boolean)
              .map(String),
          ),
        );

        let clienteLabelById: Record<string, string> = {};
        if (clienteIds.length > 0) {
          try {
            const map = await anagraficheService.getFieldValues({
              targetSlug: CLIENTI_SLUG,
              field: CLIENTI_PREVIEW_FIELD,
              ids: clienteIds,
            });
            if (!cancelled) clienteLabelById = (map as any) ?? {};
          } catch {
            // ok
          }
        }

        // 6) output
        const out: PreventivoListItem[] = filteredPreventivi.map((p: any) => {
          const data = p?.data ?? {};
          const id = String(p.id);

          const numero = String(data.numeroPreventivo ?? "").trim();
          const displayName = numero.length > 0 ? numero : String(p.displayName ?? id);

          const clienteId = data.clientePreventivo ? String(data.clientePreventivo) : "";
          const clienteLabel = clienteId ? (clienteLabelById[clienteId] ?? clienteId) : null;

          const totals = totalsByPreventivoId[id] ?? { imponibile: 0, iva: 0, totale: 0, righe: 0 };

          const statoReal = normalizeStato(statoById[id]);

          return {
            id,
            displayName,
            ownerName: p.ownerName,
            visibilityRole: p.visibilityRole ?? null,
            data,
            clienteLabel,
            statoPreventivo: statoReal.length > 0 ? statoReal : null,
            totals,
          };
        });

        if (cancelled) return;
        setItems(out);
        setTotalItems(total);
        setTotalPages(tPages);
        setStatus("success");
      } catch (e: any) {
        if (cancelled) return;
        setStatus("error");
        setError(e?.message ?? "Errore caricando preventivi");
        setItems([]);
        setTotalItems(0);
        setTotalPages(1);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [q, st, page, pageSize]);

  return { items, status, totalItems, totalPages, error };
}
