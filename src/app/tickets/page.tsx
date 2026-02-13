import { AdminUpdatesPanel } from "@/components/Admin/admin-updates-panel";

export default function TicketsPage() {
  return (
    <main className="p-4 md:p-6 2xl:p-8">
      <header className="mb-6 md:mb-8">
        <h1 className="text-2xl font-semibold text-dark dark:text-white">
          Tickets &amp; Dev Board
        </h1>
        <p className="mt-1 text-sm text-dark/70 dark:text-white/70">
          Gestisci segnalazioni, richieste e note di sviluppo in un&apos;unica vista.
        </p>
      </header>

      <AdminUpdatesPanel />
    </main>
  );
}
