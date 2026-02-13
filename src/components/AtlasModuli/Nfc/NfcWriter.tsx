"use client";

import { useState } from "react";

export function NfcWriter() {
  const [status, setStatus] = useState("Pronto");
  const [error, setError] = useState<string | null>(null);

  // Link statico di prova (da scrivere nel tag)
  const url = "https://it-evolve-atlas-dtpz.vercel.app/";

  const hasWebNfc =
    typeof window !== "undefined" && "NDEFReader" in window;

  async function writeToTag() {
    if (!hasWebNfc) {
      setStatus("Web NFC non supportato su questo dispositivo.");
      return;
    }

    try {
      setStatus("Avvicina il tag NFC al dispositivo...");
      setError(null);

      // @ts-ignore - NDEFReader non è tipizzato
      const ndef = new window.NDEFReader();

      await ndef.write({
        records: [
          {
            recordType: "url",
            data: url,
          },
        ],
      });

      setStatus("Tag scritto con successo! 🎉");
    } catch (err: any) {
      console.error(err);
      setError(err?.message ?? "Errore durante la scrittura");
      setStatus("Errore");
    }
  }

  return (
    <div className="border rounded-xl p-4 space-y-3 shadow-sm">
      <h2 className="text-lg font-semibold">Scrittura NFC</h2>

      <p className="text-sm text-gray-600">
        Questo scriverà un link statico di test nel tag NFC.
      </p>

      <button
        onClick={writeToTag}
        disabled={!hasWebNfc}
        className="px-4 py-2 rounded-lg border text-sm hover:bg-gray-50 disabled:opacity-60"
      >
        {hasWebNfc
          ? "Scrivi sul tag (Android)"
          : "Web NFC non disponibile"}
      </button>

      <p className="text-sm font-medium">Stato:</p>
      <p className="text-sm">{status}</p>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="space-y-1">
        <p className="text-sm font-medium">Link da scrivere:</p>
        <code className="text-xs bg-gray-100 px-2 py-1 rounded block break-all">
          {url}
        </code>

        <p className="text-xs text-gray-500">
          Se sei su iPhone, copia questo link e scrivilo con un’app come{" "}
          <span className="font-mono">NFC Tools</span>.
        </p>
      </div>
    </div>
  );
}
