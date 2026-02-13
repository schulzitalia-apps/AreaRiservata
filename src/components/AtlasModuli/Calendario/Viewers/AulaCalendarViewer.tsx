// src/components/AtlasModuli/Calendario/Aule/AulaCalendarViewer.tsx
"use client";

import { useEffect, useMemo } from "react";
import { useSearchParams } from "next/navigation";

import CalendarBox, {
  type AulaScope,
} from "@/components/AtlasModuli/Calendario/CalendarBox";

import { useAppDispatch, useAppSelector } from "@/components/Store/hooks";
import { fetchAulaById } from "@/components/Store/slices/auleSlice";
import { fetchAnagrafiche } from "@/components/Store/slices/anagraficheSlice";

import type { AulaDetail } from "@/components/Store/models/aule";
import type { AnagraficaPreview } from "@/components/Store/models/anagrafiche";

export default function AulaCalendarViewer() {
  const search = useSearchParams();
  const dispatch = useAppDispatch();

  const gruppoType = search.get("gruppoType") || "aule";
  const gruppoId = search.get("gruppoId");
  const label = search.get("label") ?? "(aula senza nome)";
  const partecipanteType =
    search.get("partecipanteType") || "alunni"; // es. "agenti", "alunni", ecc.

  // ------------------------- LOAD AULA + ANAGRAFICHE ------------------------

  const current = useAppSelector((s) => s.aule.current) as AulaDetail | null;

  const anagBucket = useAppSelector(
    (s) => s.anagrafiche.byType[partecipanteType],
  );
  const anagItems: AnagraficaPreview[] = anagBucket?.items ?? [];

  useEffect(() => {
    if (gruppoId) {
      // carico l'aula
      dispatch(fetchAulaById({ type: gruppoType, id: gruppoId }));
    }
  }, [dispatch, gruppoType, gruppoId]);

  useEffect(() => {
    if (current) {
      // quando ho l'aula, carico le anagrafiche del tipo corretto (agenti/alunni ecc.)
      dispatch(fetchAnagrafiche({ type: partecipanteType }));
    }
  }, [dispatch, current, partecipanteType]);

  // --------------------- COSTRUZIONE partecipantiAula -----------------------

  const partecipantiAula: AnagraficaPreview[] = useMemo(() => {
    if (!current) return [];

    // prova a leggere gli id partecipanti dall'aula (nome campo un po' difensivo)
    const raw: any[] =
      (current as any).partecipanti ??
      (current as any).partecipantiAula ??
      [];

    const ids: string[] = Array.isArray(raw)
      ? raw
        .map((p: any) => p && (p.anagraficaId ?? p.id))
        .filter(Boolean)
        .map((id: any) => String(id))
      : [];

    // se per qualsiasi motivo l'aula non ha lista partecipanti,
    // fallback: mostra tutte le anagrafiche del tipo (meglio di lista vuota)
    if (ids.length === 0) {
      return anagItems;
    }

    // altrimenti filtra solo gli iscritti all'aula
    return anagItems.filter((a) => ids.includes(String(a.id)));
  }, [current, anagItems]);

  // ----------------------------- VALIDAZIONE --------------------------------

  if (!gruppoId) {
    return (
      <div className="min-h-screen bg-gray-100 p-4 text-sm text-red-600 dark:bg-gray-950">
        Parametri mancanti: serve almeno <code>?gruppoId=...</code>{" "}
        (opzionalmente <code>gruppoType</code>, <code>label</code>,{" "}
        <code>partecipanteType</code>)
      </div>
    );
  }

  // ----------------------------- AULA SCOPE ---------------------------------

  const aulaScope: AulaScope = {
    gruppoType,                 // es. "aule-agenti"
    gruppoId,                   // id aula
    aulaLabel: label,           // nome da mostrare in UI
    partecipantiAula,           // <-- QUI ORA PASSIAMO I VERI PARTECIPANTI
    partecipanteAnagraficaType: partecipanteType, // es. "agenti"
  };

  // ----------------------------- RENDER -------------------------------------

  return (
    <div className="min-h-screen bg-gray-100 p-4 dark:bg-gray-950">
      <h1 className="mb-3 text-sm font-semibold">
        Calendario eventi per aula:{" "}
        <span className="font-bold">{label}</span>
      </h1>

      <CalendarBox aulaScope={aulaScope} />
    </div>
  );
}
