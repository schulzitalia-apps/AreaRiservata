"use client";

import { useSearchParams } from "next/navigation";
import CalendarBox from "@/components/AtlasModuli/Calendario/CalendarBox";

export default function AnagraficaCalendarViewer() {
  const search = useSearchParams();

  const type = search.get("type");
  const id = search.get("id");
  const label = search.get("label") ?? "(senza titolo)";

  if (!type || !id) {
    return (
      <div className="min-h-screen bg-gray-100 p-4 text-sm text-red-600">
        Parametri mancanti: servono <code>?type=...</code> e <code>?id=...</code>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 p-4 dark:bg-gray-950">
      <h1 className="mb-3 text-sm font-semibold">
        Calendario eventi per: <span className="font-bold">{label}</span>
      </h1>

      <CalendarBox
        anagraficaScope={{
          anagraficaType: type,
          anagraficaId: id,
          anagraficaLabel: label,
        }}
      />
    </div>
  );
}
