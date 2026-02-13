"use client";

import { useState } from "react";

export function NfcReader() {
  const [status, setStatus] = useState("In attesa…");
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const hasWebNfc =
    typeof window !== "undefined" && "NDEFReader" in window;

  async function startScan() {
    if (!hasWebNfc) {
      setStatus("Web NFC non supportato su questo dispositivo.");
      return;
    }

    try {
      setStatus("Avvicina un tag NFC…");
      setError(null);

      // @ts-ignore
      const ndef = new window.NDEFReader();
      await ndef.scan();

      ndef.onreading = (event: any) => {
        const { message } = event;
        let text = "";

        for (const record of message.records) {
          if (record.recordType === "url") {
            text += new TextDecoder().decode(record.data);
          } else if (record.recordType === "text") {
            text += new TextDecoder(record.encoding || "utf-8").decode(
              record.data
            );
          }
        }

        setResult(text || "[Nessun dato trovato]");
        setStatus("Tag letto! ✅");
      };
    } catch (err: any) {
      console.error(err);
      setError(err?.message ?? "Errore in lettura");
      setStatus("Errore");
    }
  }

  return (
    <div className="border rounded-xl p-4 space-y-3 shadow-sm">
      <h2 className="text-lg font-semibold">Lettura NFC</h2>

      <p className="text-sm text-gray-600">
        Funziona solo su Android + Chrome/Edge/Samsung Internet.
      </p>

      <button
        onClick={startScan}
        disabled={!hasWebNfc}
        className="px-4 py-2 rounded-lg border text-sm hover:bg-gray-50 disabled:opacity-60"
      >
        {hasWebNfc
          ? "Avvia lettura"
          : "Web NFC non disponibile"}
      </button>

      <p className="text-sm font-medium">Stato:</p>
      <p className="text-sm">{status}</p>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {result && (
        <div>
          <p className="text-sm font-medium">Contenuto del tag:</p>
          <code className="text-xs bg-gray-100 px-2 py-1 rounded block break-all">
            {result}
          </code>
        </div>
      )}
    </div>
  );
}
