"use client";

import dynamic from "next/dynamic";
import { useCallback, useState } from "react";
import { cn } from "@/server-utils/lib/utils";

// mappa lato client (no SSR)
const Map = dynamic(() => import("./map"), { ssr: false });

type Props = {
  className?: string;
  onRegionChange?: (region: string | null) => void; // opzionale, ma ora emettiamo anche un CustomEvent globale
};

export function RegionLabels({ className, onRegionChange }: Props) {
  const [selectedRegion, setSelectedRegion] = useState<string | null>(null);

  const handleSelect = useCallback(
    (regione: string | null) => {
      setSelectedRegion(regione);

      // callback verso il parent (se serve a te in altre pagine)
      onRegionChange?.(regione);

      // 📢 evento globale per TopSellers (che ascolta window.addEventListener('region:selected', ...))
      if (typeof window !== "undefined") {
        const detail = { code: regione ?? "ITALIA" };
        window.dispatchEvent(new CustomEvent("region:selected", { detail }));
      }
    },
    [onRegionChange]
  );

  return (
    <div
      className={cn(
        "relative h-[600px] w-full overflow-hidden rounded-[10px] bg-white shadow-1 dark:bg-gray-dark dark:shadow-card",
        className
      )}
    >
      {/* Mappa full size */}
      <div className="absolute inset-0">
        <Map onRegionSelect={handleSelect} className="w-full h-full" />
      </div>

      {/* Overlay sempre visibile con una “label” di sfondo */}
      <div className="absolute bottom-6 left-6 z-10 rounded-md bg-black/55 px-4 py-3 backdrop-blur">
        <h2 className="mb-1 text-body-2xlg font-bold text-white">
          Seleziona una Provincia
        </h2>
        <div className="text-sm text-gray-100">
          <h3>Provincia selezionata:{" "}</h3>
          <span className="font-semibold">
            {selectedRegion ?? "ITALIA"}
          </span>
        </div>
      </div>
    </div>
  );
}
