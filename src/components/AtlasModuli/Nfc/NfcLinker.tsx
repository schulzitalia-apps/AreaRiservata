"use client";

import { useState } from "react";

export function NfcLinker() {
  const [idAnagrafico, setIdAnagrafico] = useState("");
  const [uid, setUid] = useState<string | null>(null);
  const [status, setStatus] = useState("In attesa…");
  const [error, setError] = useState<string | null>(null);

  const hasWebNfc =
    typeof window !== "undefined" && "NDEFReader" in window;

  async function readUidAndLink() {
    if (!idAnagrafico) {
      setStatus("Inserisci prima un id anagrafico.");
      return;
    }

    if (!hasWebNfc) {
      setStatus("Web NFC non supportato su questo dispositivo.");
      return;
    }

    try {
      setError(null);
      setStatus("Avvicina il tag NFC per leggere l'UID…");

      // @ts-ignore
      const ndef = new window.NDEFReader();
      await ndef.scan();

      ndef.onreading = (event: any) => {
        try {
          const tagUid = event.serialNumber as string | undefined;

          if (!tagUid) {
            setError("UID non disponibile su questo tag.");
            setStatus("Errore");
            return;
          }

          setUid(tagUid);
          setStatus("UID letto, invio chiamata di associazione…");

          // MOCKUP: qui lanceresti la tua chiamata API interna
          // es: POST /api/nfc/link { uid: tagUid, idAnagrafico }
          console.log("Mock chiamata API: link NFC -> anagrafica", {
            uid: tagUid,
            idAnagrafico,
          });

          // placeholder: simuliamo risposta ok
          setTimeout(() => {
            setStatus(
              `Tag UID ${tagUid} associato a idAnagrafico ${idAnagrafico} ✅`
            );
          }, 500);
        } catch (err: any) {
          console.error(err);
          setError(err?.message ?? "Errore lettura UID");
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
      <h2 className="text-lg font-semibold">Associa NFC ↔ Anagrafica</h2>
      <p className="text-sm text-gray-600">
        1. Inserisci l&apos;ID anagrafico interno. <br />
        2. Premi il bottone e avvicina il tag NFC. <br />
        3. L&apos;app leggerà l&apos;UID e lancerà una chiamata mock
        di associazione.
      </p>

      <div className="space-y-2">
        <label className="flex flex-col gap-1 text-sm">
          ID anagrafico
          <input
            value={idAnagrafico}
            onChange={(e) => setIdAnagrafico(e.target.value)}
            className="border rounded-lg px-2 py-1 text-sm"
            placeholder="es. 12345"
          />
        </label>
      </div>

      <button
        onClick={readUidAndLink}
        disabled={!hasWebNfc}
        className="px-4 py-2 rounded-lg border text-sm hover:bg-gray-50 disabled:opacity-60"
      >
        {hasWebNfc
          ? "Leggi UID e associa"
          : "Web NFC non disponibile"}
      </button>

      <div className="space-y-1">
        <p className="text-sm font-medium">Stato:</p>
        <p className="text-sm">{status}</p>
      </div>

      {uid && (
        <div className="space-y-1">
          <p className="text-sm font-medium">Ultimo UID letto:</p>
          <code className="text-xs bg-gray-100 px-2 py-1 rounded block">
            {uid}
          </code>
        </div>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}

      {!hasWebNfc && (
        <p className="text-xs text-amber-600">
          Questa parte funziona solo su Android + Chrome/Edge.
        </p>
      )}
    </div>
  );
}
