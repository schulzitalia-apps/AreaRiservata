import BarcodeScannerButton from "@/components/BarcodeButton";

export default function Home() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-2 px-4 py-10 text-dark-5 dark:bg-[#020D1A] dark:text-dark-6">
      <div className="w-full max-w-xl rounded-2xl bg-white p-6 shadow-6 ring-1 ring-gray-2/60 dark:bg-dark-4 dark:shadow-card-6 dark:ring-dark-3">
        <header className="mb-5 flex flex-col gap-1">
          <h1 className="text-heading-6 font-semibold text-dark dark:text-white">
            Lettore barcode
          </h1>
          <p className="text-sm text-gray-6 dark:text-dark-6">
            Premi “Leggi barcode”, concede i permessi della fotocamera e
            inquadra un codice a barre o QR. Il valore letto verrà mostrato qui
            sotto.
          </p>
        </header>

        <section className="space-y-4">
          <BarcodeScannerButton />

          <div className="mt-4 rounded-xl border border-dashed border-gray-3 bg-gray-2 px-4 py-3 text-xs text-gray-6 dark:border-dark-3 dark:bg-dark-2 dark:text-dark-6">
            Suggerimento: avvicina il codice alla camera, assicurati che sia
            ben illuminato e mantienilo fermo per qualche secondo. Se non viene
            letto, prova a premere{" "}
            <span className="font-semibold text-primary">
              “Nuova lettura”
            </span>
            .
          </div>
        </section>
      </div>
    </main>
  );
}
