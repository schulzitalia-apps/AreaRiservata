// src/app/dev/Mail-admin/page.tsx
import type { Metadata } from "next";
import Link from "next/link";
import Breadcrumb from "@/components/Breadcrumbs/Breadcrumb";
import MailAdminPanel from "@/components/Admin/MailAdminPanel";

export const metadata: Metadata = {
  title: "Amministrazione Email",
  description: "Configurazione mittenti, ruoli e template email",
};

export default function Page() {
  return (
    <main className="min-h-screen p-6">
      <div className="mx-auto w-full max-w-5xl">
        <Breadcrumb pageName="Dev / Amministrazione Email" />

        {/* Barra azioni (dev) */}
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Link
            href="/admin/action-mail"
            className="
              inline-flex items-center rounded-md bg-primary px-4 py-2
              text-sm font-semibold text-white hover:opacity-90
            "
          >
            Vai a “Email per Azioni”
          </Link>

          <span className="text-xs text-dark/60 dark:text-white/60">
            Da qui configuri le regole email collegate alle Actions (invio immediato o programmato).
          </span>
        </div>

        <div className="mt-4">
          <MailAdminPanel />
        </div>
      </div>
    </main>
  );
}
