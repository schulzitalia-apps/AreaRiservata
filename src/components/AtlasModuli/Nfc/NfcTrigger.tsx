"use client";

import { useState } from "react";

export function NfcTrigger() {
  const [status, setStatus] = useState("In attesa…");
  const [lastToken, setLastToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const hasWebNfc =
    typeof window !== "undefined" && "NDEFReader" in window;

  async function readAndRedirect() {
    if (!hasWebNfc) {
      setStatus("Web NFC non supportato su questo dispositivo.");
      return;
    }

    try {
      setStatus("Avvicina il tag NFC per leggere il token…");
      setError(null);

      // @ts-ignore
      const ndef = new window.NDEFReader();
      await ndef.scan();

      ndef.onreading = (event: any) => {
        try {
          const { message } = event;
          let token = "";

          for (const record of message.records) {
            if (record.recordType === "text") {
              token = new TextDecoder(
                record.encoding || "utf-8"
              ).decode(record.data);
            } else if (record.recordType === "url") {
              token = new TextDecoder("utf-8").decode(record.data);
            }
          }

          if (!token) {
            setStatus("Nessun token trovato sul tag.");
            return;
          }

          setLastToken(token);
          setStatus("Token letto, redirect verso API…");

          // MOCK: qui potresti avere:
          // - se token è già una URL completa: window.location.href = token
          // - se token è solo un codice: costruisci l'URL per l'API
          //
          // Esempio 1: token = "ABC123" -> /api/nfc/event?t=ABC123
          const isFullUrl = token.startsWith("http://") || token.startsWith("https://");
          const targetUrl = isFullUrl
            ? token
            : `/api/nfc/event?t=${encodeURIComponent(token)}`;

          console.log("Mock redirect verso:", targetUrl);

          // Per ora NON facciamo davvero redirect, così non rompe i test.
          // Quando vuoi, puoi scommentare:
          // window.location.href = targetUrl;
        } catch (err: any) {
          console.error(err);
          setError(err?.message ?? "Errore nella lettura del token");
          setStatus("Errore");
        }
      };
    } catch (err: any) {
      console.error(err);
      setError(err?.message ?? "Impossibile avviare la lettura NFC");
      setStatus("Errore");
    }
  }

  return (
    <div className="border rounded-xl p-4 space-y-3 shadow-sm">
      <h2 className="text-lg font-semibold">Lettura NFC → Link/API</h2>
      <p className="text-sm text-gray-600">
        Legge un token/URL dal tag e costruisce l&apos;URL dell&apos;API
        da chiamare. Per ora è solo un mock (log e niente redirect reale).
      </p>

      <button
        onClick={readAndRedirect}
        disabled={!hasWebNfc}
        className="px-4 py-2 rounded-lg border text-sm hover:bg-gray-50 disabled:opacity-60"
      >
        {hasWebNfc
          ? "Leggi e prepara chiamata"
          : "Web NFC non disponibile"}
      </button>

      <div className="space-y-1">
        <p className="text-sm font-medium">Stato:</p>
        <p className="text-sm">{status}</p>
      </div>

      {lastToken && (
        <div className="space-y-1">
          <p className="text-sm font-medium">Ultimo token/URL letto:</p>
          <code className="text-xs bg-gray-100 px-2 py-1 rounded block break-all">
            {lastToken}
          </code>
        </div>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}

      {!hasWebNfc && (
        <p className="text-xs text-amber-600">
          Anche qui: funziona solo su Android + Chrome/Edge.
          Su iPhone useremo i tag con URL e il sistema aprirà direttamente
          la pagina, senza passare da Web NFC.
        </p>
      )}
    </div>
  );
}
