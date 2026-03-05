// src/app/app/spese/page.tsx
"use client";

import Breadcrumb from "@/components/Breadcrumbs/Breadcrumb";
import ConfermeOrdineOverview from "@/components/AtlasModuli/Conferme/ConfermeOrdineOverview";

export default function StatsPage() {
  return (
    <div className="mx-auto w-full max-w-[1400px] space-y-6">
      <Breadcrumb pageName="Stats" />
      <ConfermeOrdineOverview />
    </div>
  );
}
