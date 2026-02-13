import { NfcReader } from "@/components/AtlasModuli/Nfc/NfcReader";
import { NfcWriter } from "@/components/AtlasModuli/Nfc/NfcWriter";

export default function NfcPage() {
  return (
    <main className="min-h-screen px-4 py-8 flex justify-center">
      <div className="max-w-3xl w-full space-y-6">
        <h1 className="text-2xl font-bold">Test NFC</h1>
        <p className="text-sm text-gray-600">
          Questa pagina permette di testare lettura e scrittura NFC da
          browser usando Web NFC.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <NfcWriter />
          <NfcReader />
        </div>

        <p className="text-xs text-gray-500">
          ⚠️ Scrittura/lettura da browser funziona solo su Android con
          Chrome o browser basati su Chromium, e solo in HTTPS.
          <br />
          📱 Su iPhone puoi solo *leggere* il tag come link (scrittura non
          supportata).
        </p>
      </div>
    </main>
  );
}
