// src/components/BarcodeScannerButton.tsx
"use client";

import React, { useEffect, useRef, useState } from "react";
import { BrowserMultiFormatReader, IScannerControls } from "@zxing/browser";

// ✅ Redux store
import { useAppDispatch } from "@/components/Store/hooks";
import {
  fetchAnagrafiche,
  fetchAnagrafica,
  updateAnagrafica as updateAnagraficaThunk,
} from "@/components/Store/slices/anagraficheSlice";

const ANAGRAFICA_SLUG = "conferme-ordine";

const STATO_VALUES = ["Taglio", "Vetraggio", "Ferramenta", "Imballaggio", "Spedizione"] as const;
type StatoAvanzamento = (typeof STATO_VALUES)[number];

function extractNumeroOrdine(barcodeRaw: string): string {
  const raw = (barcodeRaw || "").trim();
  if (!raw) return "";

  const digits = raw.replace(/\D/g, "").slice(0, 5);
  if (!digits) return "";

  const normalized = digits.replace(/^0+/, "");
  return normalized === "" ? "0" : normalized;
}

function computeNextStatoAvanzamento(current: any): StatoAvanzamento {
  const cur = (current == null ? "" : String(current)).trim();
  const idx = STATO_VALUES.indexOf(cur as StatoAvanzamento);
  if (idx < 0) return "Taglio";
  return STATO_VALUES[(idx + 1) % STATO_VALUES.length];
}

const BarcodeScannerButton: React.FC = () => {
  const dispatch = useAppDispatch();

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const readerRef = useRef<BrowserMultiFormatReader | null>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const overlayTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [isInitializingCamera, setIsInitializingCamera] = useState(false);
  const [isScanning, setIsScanning] = useState(false);

  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [showOverlay, setShowOverlay] = useState(false);

  const [execBusy, setExecBusy] = useState(false);
  const [execError, setExecError] = useState<string | null>(null);

  const [foundDoc, setFoundDoc] = useState<any | null>(null);
  const [prevStatus, setPrevStatus] = useState<string | null>(null);
  const [nextStatus, setNextStatus] = useState<string | null>(null);

  const [selectedStatus, setSelectedStatus] = useState<StatoAvanzamento | "">("");

  useEffect(() => {
    return () => {
      if (controlsRef.current) {
        controlsRef.current.stop();
        controlsRef.current = null;
      }
      if (overlayTimeoutRef.current) clearTimeout(overlayTimeoutRef.current);
    };
  }, []);

  async function executeFlow(barcodeRaw: string) {
    setExecError(null);
    setFoundDoc(null);
    setPrevStatus(null);
    setNextStatus(null);

    const numeroOrdine = extractNumeroOrdine(barcodeRaw);
    if (!numeroOrdine) {
      setExecError("Barcode vuoto o non valido");
      return;
    }

    setExecBusy(true);
    try {
      const listOut = await dispatch(
        fetchAnagrafiche({
          type: ANAGRAFICA_SLUG,
          query: numeroOrdine,
          page: 1,
          pageSize: 50,
          fields: ["numeroOrdine", "codiceCliente", "riferimento", "statoAvanzamento"],
        }),
      ).unwrap();

      const items = listOut.items ?? [];
      if (!items.length) {
        throw new Error(`Nessuna conferma d'ordine trovata (query=${numeroOrdine})`);
      }

      const exact = items.find(
        (x: any) => String(x?.data?.numeroOrdine ?? "").trim() === numeroOrdine,
      );

      if (!exact) {
        throw new Error(
          `Trovati ${items.length} risultati, ma nessuno con numeroOrdine ESATTO = ${numeroOrdine}`,
        );
      }

      // ✅ AnagraficaPreview ha SOLO id (niente _id)
      const id = String(exact.id ?? "");
      if (!id) throw new Error("Record trovato ma senza id");

      const current = exact?.data?.statoAvanzamento;
      const nextAuto = computeNextStatoAvanzamento(current);
      const next: StatoAvanzamento = (selectedStatus || nextAuto) as StatoAvanzamento;

      setFoundDoc(exact);
      setPrevStatus(current == null ? "" : String(current));
      setNextStatus(next);

      await dispatch(
        updateAnagraficaThunk({
          type: ANAGRAFICA_SLUG,
          id,
          data: { data: { statoAvanzamento: next } },
        }),
      ).unwrap();

      const full = await dispatch(fetchAnagrafica({ type: ANAGRAFICA_SLUG, id })).unwrap();
      setFoundDoc(full.data);

      setSelectedStatus("");
    } catch (e: any) {
      setExecError(e?.message || "Errore operazione");
    } finally {
      setExecBusy(false);
    }
  }

  const startScan = async () => {
    if (!videoRef.current) return;

    setResult(null);
    setError(null);
    setExecError(null);
    setShowOverlay(false);
    setFoundDoc(null);
    setPrevStatus(null);
    setNextStatus(null);

    if (controlsRef.current) {
      controlsRef.current.stop();
      controlsRef.current = null;
    }

    if (!readerRef.current) {
      readerRef.current = new BrowserMultiFormatReader();
    }

    setIsInitializingCamera(true);
    setIsScanning(false);

    try {
      const controls = await readerRef.current.decodeFromVideoDevice(
        undefined,
        videoRef.current,
        async (scanResult, err, ctrl) => {
          if (scanResult) {
            const text = scanResult.getText();

            setResult(text);
            setIsScanning(false);
            setIsInitializingCamera(false);

            ctrl.stop();
            controlsRef.current = null;

            setShowOverlay(true);
            if (overlayTimeoutRef.current) clearTimeout(overlayTimeoutRef.current);
            overlayTimeoutRef.current = setTimeout(() => setShowOverlay(false), 10000);

            await executeFlow(text);
          }

          if (err && !(err as any).message?.includes("No barcode")) {
            // opzionale
          }
        },
      );

      controlsRef.current = controls;
      setIsInitializingCamera(false);
      setIsScanning(true);
    } catch (err: any) {
      console.error(err);
      setError(err?.message ?? "Errore durante l'avvio della fotocamera.");
      setIsInitializingCamera(false);
      setIsScanning(false);
    }
  };

  const stopScan = () => {
    if (controlsRef.current) {
      controlsRef.current.stop();
      controlsRef.current = null;
    }
    setIsScanning(false);
    setIsInitializingCamera(false);
  };

  const handleNewScan = () => {
    if (overlayTimeoutRef.current) clearTimeout(overlayTimeoutRef.current);
    setShowOverlay(false);
    setResult(null);
    setError(null);
    setExecError(null);
    setFoundDoc(null);
    setPrevStatus(null);
    setNextStatus(null);
    startScan();
  };

  const mainButtonLabel = isInitializingCamera
    ? "Sto attivando la camera..."
    : isScanning
      ? "Sto leggendo..."
      : "Leggi barcode";

  const statusLabel = isInitializingCamera ? "Inizializzazione" : isScanning ? "Attiva" : "Inattiva";

  const statusClasses = isInitializingCamera
    ? "bg-yellow-light-4 text-yellow-dark"
    : isScanning
      ? "bg-green-light-7 text-green-dark"
      : "bg-gray-2 text-gray-6 dark:bg-dark-3 dark:text-dark-6";

  const statusDotClasses = isInitializingCamera
    ? "bg-yellow-dark"
    : isScanning
      ? "bg-green"
      : "bg-gray-5";

  const isBusy = isInitializingCamera || isScanning;

  const numeroOrdine = result ? extractNumeroOrdine(result) : "";

  const overlayActionText =
    selectedStatus
      ? `CONFERME ORDINE → set statoAvanzamento = ${selectedStatus}`
      : `CONFERME ORDINE → switch statoAvanzamento (ciclo)`;

  const previewNumero = foundDoc?.data?.numeroOrdine ?? numeroOrdine ?? "-----";
  const previewCliente = foundDoc?.data?.codiceCliente ?? "";
  const previewRif = foundDoc?.data?.riferimento ?? "";

  return (
    <>
      <div className="flex w-full flex-col gap-4">
        <div className="order-1 md:order-2">
          <div className="relative mt-2 overflow-hidden rounded-xl border border-gray-3 bg-dark-4 shadow-card-6 dark:border-dark-3 dark:bg-dark-2">
            <div className="flex items-center justify-between border-b border-gray-3 px-4 py-2 text-xs font-medium text-gray-7 dark:border-dark-3 dark:text-dark-6">
              <span>Anteprima fotocamera</span>
              <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] ${statusClasses}`}>
                <span className={`h-1.5 w-1.5 rounded-full ${statusDotClasses}`} />
                {statusLabel}
              </span>
            </div>

            <div className="relative bg-black">
              <div className="aspect-4/3 w-full">
                <video ref={videoRef} className="h-full w-full object-cover" autoPlay muted />
              </div>

              <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <div className="h-40 w-64 rounded-2xl border-2 border-primary/80 shadow-[0_0_0_9999px_rgba(0,0,0,0.45)]" />
              </div>
            </div>
          </div>
        </div>

        <div className="order-2 md:order-1">
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={startScan}
              disabled={isBusy}
              className="inline-flex items-center justify-center rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white shadow-2 transition hover:bg-red-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-gray-2 disabled:cursor-not-allowed disabled:opacity-65 dark:focus-visible:ring-offset-dark"
            >
              {mainButtonLabel}
            </button>

            <button
              type="button"
              onClick={stopScan}
              disabled={!isBusy}
              className="inline-flex items-center justify-center rounded-lg border border-gray-5 bg-white px-4 py-2 text-sm font-medium text-gray-7 shadow-card-8 transition hover:border-primary hover:text-primary disabled:cursor-not-allowed disabled:opacity-65 dark:border-dark-3 dark:bg-dark-2 dark:text-dark-6 dark:hover:border-primary dark:hover:text-primary"
            >
              Stop
            </button>

            <button
              type="button"
              onClick={handleNewScan}
              disabled={isBusy}
              className="inline-flex items-center justify-center rounded-lg border border-transparent bg-gray-2 px-4 py-2 text-xs font-medium text-gray-7 transition hover:border-primary hover:bg-gray-3 hover:text-primary disabled:cursor-not-allowed disabled:opacity-65 dark:bg-dark-2 dark:text-dark-6 dark:hover:border-primary dark:hover:bg-dark-3"
            >
              Nuova lettura
            </button>

            <div className="flex items-center gap-2">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-6 dark:text-dark-6">
                Stato:
              </span>

              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value as any)}
                className="h-9 rounded-lg border border-gray-5 bg-white px-3 text-sm text-gray-7 shadow-card-8 transition focus:outline-none focus:ring-2 focus:ring-primary dark:border-dark-3 dark:bg-dark-2 dark:text-dark-6"
              >
                <option value="">Auto (ciclo)</option>
                {STATO_VALUES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {isBusy && (
            <div className="relative mt-2 h-10 w-full overflow-hidden rounded-xl bg-green-light-7/40 ring-1 ring-green-light-3 shadow-card-6 dark:bg-green-light-6/40">
              <div className="absolute inset-0 flex items-stretch justify-around px-4">
                <div className="h-full w-4 rounded-md bg-green animate-line1" />
                <div className="h-full w-4 rounded-md bg-green animate-line2" />
                <div className="h-full w-4 rounded-md bg-green animate-line3" />
                <div className="h-full w-4 rounded-md bg-green animate-line1" />
                <div className="h-full w-4 rounded-md bg-green animate-line2" />
                <div className="h-full w-4 rounded-md bg-green animate-line3" />
              </div>
              <div className="relative z-10 flex h-full items-center justify-center">
                <span className="rounded-full bg-green-dark/90 px-4 py-1 text-[11px] font-semibold uppercase tracking-wide text-white shadow-2">
                  {isInitializingCamera ? "Avvio lettore..." : "Lettura in corso..."}
                </span>
              </div>
            </div>
          )}

          {result && (
            <div className="mt-2 rounded-xl border border-green-light-3 bg-green-light-7/60 px-4 py-3 text-sm text-gray-7 shadow-card-6 dark:border-green-light-3 dark:bg-green-light-6/40 dark:text-dark-7">
              <div className="mb-1 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-green-dark dark:text-green">
                <span className="h-2 w-2 rounded-full bg-green" />
                Barcode letto
              </div>

              <p className="font-mono text-base font-semibold text-dark dark:text-white">
                NUMERO ORDINE: <span className="tracking-widest">{numeroOrdine || "-----"}</span>
              </p>

              <p className="mt-1 break-all text-[11px] text-gray-6 dark:text-dark-6">
                Codice completo: <span className="font-mono">{result}</span>
              </p>

              {execBusy && (
                <p className="mt-2 text-[11px] text-gray-6 dark:text-dark-6">
                  Sto cercando e aggiornando la conferma d’ordine…
                </p>
              )}

              {foundDoc && (
                <div className="mt-2 rounded-lg bg-white/60 px-3 py-2 text-[12px] text-dark shadow-card-8 dark:bg-dark-3/50 dark:text-white">
                  <div className="flex flex-wrap gap-x-4 gap-y-1">
                    <span className="font-semibold">Cliente:</span> <span>{previewCliente || "—"}</span>
                    <span className="font-semibold">Rif:</span> <span>{previewRif || "—"}</span>
                  </div>

                  <div className="mt-1">
                    <span className="font-semibold">statoAvanzamento:</span>{" "}
                    <span className="font-mono">
                      {prevStatus ?? "—"} → {nextStatus ?? "—"}
                    </span>
                  </div>
                </div>
              )}

              {execError && (
                <p className="mt-2 text-[11px] text-red-dark">
                  Operazione fallita: {execError}
                </p>
              )}
            </div>
          )}

          {error && (
            <div className="mt-2 rounded-xl border border-red-light-3 bg-red-light-5 px-4 py-3 text-sm text-red-dark shadow-card-6 dark:border-red-dark dark:bg-red-light-6/60 dark:text-red-dark">
              <div className="mb-1 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide">
                <span className="h-2 w-2 rounded-full bg-red" />
                Errore
              </div>
              <p className="text-sm">{error}</p>
            </div>
          )}
        </div>
      </div>

      {showOverlay && result && (
        <div className="fixed inset-0 z-999999 flex items-center justify-center bg-green text-white">
          <div className="px-6 text-center">
            <p className="mb-4 text-[11px] font-mono opacity-80">SLUG: {ANAGRAFICA_SLUG}</p>

            <p className="mb-4 text-heading-5 font-bold tracking-wide">{overlayActionText}</p>

            <h2 className="mb-3 text-heading-4 font-bold tracking-wide">CODICE LETTO</h2>

            <p className="mb-2 text-body-2xlg font-semibold tracking-widest">
              NUMERO ORDINE: {previewNumero || "-----"}
            </p>

            {foundDoc && (
              <p className="mt-2 text-[12px] opacity-90">
                statoAvanzamento:{" "}
                <span className="font-mono">
                  {prevStatus ?? "—"} → {nextStatus ?? "—"}
                </span>
              </p>
            )}

            {execBusy && <p className="mt-3 text-[11px] opacity-80">Aggiornamento in corso…</p>}
            {execError && <p className="mt-3 text-[11px] text-red-200">Errore: {execError}</p>}

            <p className="mt-4 text-[11px] opacity-80">
              Codice completo: <span className="font-mono break-all">{result}</span>
            </p>
          </div>
        </div>
      )}
    </>
  );
};

export default BarcodeScannerButton;
