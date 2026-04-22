"use client";

import { useEffect, useState } from "react";
import type { Notice, VariantConfigDTO } from "./types";
import type { ExportVariantConfigDTO } from "./exportTypes";
import InlineAlert from "./ui/InlineAlert";
import SlugPicker from "./sections/SlugPicker";
import VariantsListBox from "./sections/VariantsListBox";
import ExportVariantsListBox from "./sections/ExportVariantsListBox";
import { apiListVariants } from "./api";
import { apiListExportVariants } from "./exportApi";
import { ANAGRAFICA_TYPES as PUBLIC_ANAGRAFICA_TYPES } from "@/config/anagrafiche.types.public";

export default function VariantsAdmin() {
  const [notice, setNotice] = useState<Notice>(null);
  const [tool, setTool] = useState<"anagrafiche" | "export">("anagrafiche");

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 4000);
    return () => clearTimeout(t);
  }, [notice]);

  const firstSlug = (PUBLIC_ANAGRAFICA_TYPES as any)?.[0]?.slug ?? "clienti";
  const [slug, setSlug] = useState<string>(firstSlug);

  const [variantsLoading, setVariantsLoading] = useState(false);
  const [variantItems, setVariantItems] = useState<VariantConfigDTO[]>([]);
  const [exportLoading, setExportLoading] = useState(false);
  const [exportItems, setExportItems] = useState<ExportVariantConfigDTO[]>([]);

  async function refreshVariants() {
    setVariantsLoading(true);
    try {
      const list = await apiListVariants(slug);
      setVariantItems(list);
    } catch (e: any) {
      setNotice({ type: "error", text: e?.message || "Errore caricamento varianti" });
      setVariantItems([]);
    } finally {
      setVariantsLoading(false);
    }
  }

  async function refreshExportVariants() {
    setExportLoading(true);
    try {
      const list = await apiListExportVariants(slug);
      setExportItems(list);
    } catch (e: any) {
      setNotice({ type: "error", text: e?.message || "Errore caricamento varianti export" });
      setExportItems([]);
    } finally {
      setExportLoading(false);
    }
  }

  useEffect(() => {
    // I due strumenti restano volutamente separati:
    // carichiamo solo il ramo attivo per non mischiare stati e responsabilita.
    if (tool === "export") {
      refreshExportVariants();
      return;
    }
    refreshVariants();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug, tool]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-dark dark:text-white">
          Gestione Varianti
        </h1>
        <p className="mt-1 text-sm text-dark-6">
          Due strumenti separati nello stesso pannello: uno per le varianti anagrafiche e uno per gli schemi export salvati.
        </p>
      </div>

      <InlineAlert notice={notice} onClose={() => setNotice(null)} />

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setTool("anagrafiche")}
          className={`rounded-md px-3 py-2 text-sm font-medium transition ${
            tool === "anagrafiche"
              ? "bg-primary text-white dark:bg-blue-light"
              : "border border-stroke text-dark hover:bg-gray-2 dark:border-dark-3 dark:text-white dark:hover:bg-dark-2"
          }`}
        >
          Gestione varianti anagrafiche
        </button>
        <button
          type="button"
          onClick={() => setTool("export")}
          className={`rounded-md px-3 py-2 text-sm font-medium transition ${
            tool === "export"
              ? "bg-primary text-white dark:bg-blue-light"
              : "border border-stroke text-dark hover:bg-gray-2 dark:border-dark-3 dark:text-white dark:hover:bg-dark-2"
          }`}
        >
          Gestione varianti export
        </button>
      </div>

      <SlugPicker value={slug} onChange={setSlug} />

      {tool === "export" ? (
        <ExportVariantsListBox
          anagraficaSlug={slug}
          items={exportItems}
          loading={exportLoading}
          onRefresh={refreshExportVariants}
          onNotice={setNotice}
        />
      ) : (
        <VariantsListBox
          anagraficaSlug={slug}
          items={variantItems}
          loading={variantsLoading}
          onRefresh={refreshVariants}
          onNotice={setNotice}
        />
      )}
    </div>
  );
}
