"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { EventoFull } from "@/components/Store/models/eventi";
import { eventiService } from "@/components/Store/services/eventiService";

type Key = string; // `${typeSlug}:${id}`
type Target = { typeSlug: string; id: string };

function makeKey(typeSlug: string, id: string): Key {
  return `${typeSlug}:${id}`;
}

function buildSignature(targets: Target[]): string {
  // stabile indipendentemente dall'ordine
  const keys = targets.map((t) => makeKey(t.typeSlug, t.id)).sort();
  return keys.join("|");
}

/** pool semplice per limitare concorrenza */
async function runPool<T>(
  items: T[],
  worker: (item: T) => Promise<void>,
  concurrency = 4,
) {
  let idx = 0;

  const runners = Array.from({ length: Math.max(1, concurrency) }, async () => {
    while (idx < items.length) {
      const current = items[idx++];
      await worker(current);
    }
  });

  await Promise.all(runners);
}

export function useWhiteboardEventDetails(targets: Target[], enabled = true) {
  const [detailsByKey, setDetailsByKey] = useState<Record<Key, EventoFull>>({});
  const [loading, setLoading] = useState(false);

  // ref per non mettere targets in deps
  const targetsRef = useRef<Target[]>(targets);
  targetsRef.current = targets;

  // ref per avere sempre cache aggiornata nel calcolo "missing"
  const detailsRef = useRef(detailsByKey);
  useEffect(() => {
    detailsRef.current = detailsByKey;
  }, [detailsByKey]);

  // evita doppie fetch contemporanee
  const inFlightRef = useRef<Set<Key>>(new Set());

  // signature stabile (solo quando cambiano davvero type/id)
  const signature = useMemo(() => buildSignature(targets), [targets]);

  useEffect(() => {
    if (!enabled) return;

    const wantedKeys = new Set(signature ? signature.split("|") : []);

    // 1) prune cache (tieni solo quelli ancora richiesti)
    setDetailsByKey((prev) => {
      let changed = false;
      const next: Record<Key, EventoFull> = {};

      for (const k of Object.keys(prev)) {
        if (wantedKeys.has(k)) next[k] = prev[k];
        else changed = true;
      }

      return changed ? next : prev;
    });

    // 2) calcola missing rispetto alla cache "live"
    const targetsNow = targetsRef.current;
    const cacheNow = detailsRef.current;

    const missing = targetsNow.filter((t) => {
      const k = makeKey(t.typeSlug, t.id);
      if (!wantedKeys.has(k)) return false;
      if (cacheNow[k]) return false;
      if (inFlightRef.current.has(k)) return false;
      return true;
    });

    if (missing.length === 0) return;

    let cancelled = false;

    (async () => {
      setLoading(true);
      try {
        const collected: Record<Key, EventoFull> = {};

        // marca in-flight subito
        missing.forEach((t) => inFlightRef.current.add(makeKey(t.typeSlug, t.id)));

        await runPool(
          missing,
          async (t) => {
            const k = makeKey(t.typeSlug, t.id);
            try {
              const full = await eventiService.getOne({ type: t.typeSlug, id: t.id });
              if (!cancelled) collected[k] = full;
            } catch {
              // ignora errore singolo
            } finally {
              inFlightRef.current.delete(k);
            }
          },
          4,
        );

        if (!cancelled && Object.keys(collected).length > 0) {
          setDetailsByKey((prev) => ({ ...prev, ...collected }));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [signature, enabled]);

  return { detailsByKey, loading };
}
