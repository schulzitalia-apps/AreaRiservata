// src/app/inbox/page.tsx
import { Suspense } from "react";
import Breadcrumb from "@/components/Breadcrumbs/Breadcrumb";
import InboxBox from "@/components/Inbox";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Centro Assistenza",
  description: "Gestione messaggi e notifiche",
};

export default function InboxPage() {
  return (
    <>
      <Breadcrumb pageName="Centro Assistenza di Schulz" />
      <Suspense fallback={<div className="p-4">Caricamento inbox…</div>}>
        <InboxBox />
      </Suspense>
    </>
  );
}
