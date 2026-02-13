import { Suspense } from "react";
import AnagraficaCalendarViewer from "@/components/AtlasModuli/Calendario/Viewers/AnagraficaCalendarViewer";

export default function Page() {
  return (
    <Suspense fallback={<div className="p-4 text-sm">Caricamento…</div>}>
      <AnagraficaCalendarViewer />
    </Suspense>
  );
}
