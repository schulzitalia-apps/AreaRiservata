// src/app/app/spese/page.tsx
"use client";

import Breadcrumb from "@/components/Breadcrumbs/Breadcrumb";
import BilancioOverview from "@/components/AtlasModuli/Bilancio/BilancioOverview";

export default function SpesePage() {
  return (
    <div className="mx-auto w-full max-w-[1400px] space-y-6">
      <Breadcrumb pageName="Bilancio" />
      <BilancioOverview />
    </div>
  );
}
