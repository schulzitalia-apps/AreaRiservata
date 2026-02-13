// src/app/app/spese/page.tsx
"use client";

import Breadcrumb from "@/components/Breadcrumbs/Breadcrumb";
import RicaviOverview from "@/components/AtlasModuli/Ricavi/RicaviOverview";

export default function SpesePage() {
  return (
    <div className="mx-auto w-full max-w-[1400px] space-y-6">
      <Breadcrumb pageName="Ricavi" />
      <RicaviOverview />
    </div>
  );
}
