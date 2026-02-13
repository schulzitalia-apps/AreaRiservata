// src/app/app/spese/page.tsx
"use client";

import Breadcrumb from "@/components/Breadcrumbs/Breadcrumb";
import SpeseOverview from "@/components/AtlasModuli/Spese/SpeseOverview";

export default function SpesePage() {
  return (
    <div className="mx-auto w-full max-w-[1400px] space-y-6">
      <Breadcrumb pageName="Spese" />
      <SpeseOverview />
    </div>
  );
}
