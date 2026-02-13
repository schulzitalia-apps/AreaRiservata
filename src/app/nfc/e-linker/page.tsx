import { NfcLinker } from "@/components/AtlasModuli/Nfc/NfcLinker";
import { NfcTrigger } from "@/components/AtlasModuli/Nfc/NfcTrigger";

export default function NfcModelPage() {
  return (
    <main className="min-h-screen px-4 py-8 flex justify-center">
      <div className="max-w-4xl w-full space-y-6">
        <header className="space-y-2">
          <h1 className="text-2xl font-bold">Modello NFC (mock)</h1>
          <p className="text-sm text-gray-600">
            Demo semplificata: parte di associazione UID ↔ anagrafica e
            parte di lettura che prepara una chiamata API/link.
          </p>
        </header>

        <div className="grid gap-4 md:grid-cols-2">
          <NfcLinker />
          <NfcTrigger />
        </div>
      </div>
    </main>
  );
}
