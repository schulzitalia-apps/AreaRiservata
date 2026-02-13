// app/calendar/aula-popup/page.tsx
import { Suspense } from "react";
import AulaCalendarViewer from "@/components/AtlasModuli/Calendario/Viewers/AulaCalendarViewer";

export default function Page() {
  return (
    <Suspense fallback={<div className="p-4 text-sm">Caricamento…</div>}>
      <AulaCalendarViewer />
    </Suspense>
  );
}
