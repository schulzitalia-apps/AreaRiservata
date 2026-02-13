"use client";

import { useEffect, useState } from "react";
import type { Notice, VariantConfigDTO } from "./types";
import InlineAlert from "./ui/InlineAlert";
import SlugPicker from "./sections/SlugPicker";
import VariantsListBox from "./sections/VariantsListBox";
import { apiListVariants } from "./api";
import { ANAGRAFICA_TYPES as PUBLIC_ANAGRAFICA_TYPES } from "@/config/anagrafiche.types.public";

export default function VariantsAdmin() {
  const [notice, setNotice] = useState<Notice>(null);

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 4000);
    return () => clearTimeout(t);
  }, [notice]);

  const firstSlug = (PUBLIC_ANAGRAFICA_TYPES as any)?.[0]?.slug ?? "clienti";
  const [slug, setSlug] = useState<string>(firstSlug);

  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<VariantConfigDTO[]>([]);

  async function refresh() {
    setLoading(true);
    try {
      const list = await apiListVariants(slug);
      setItems(list);
    } catch (e: any) {
      setNotice({ type: "error", text: e?.message || "Errore caricamento varianti" });
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-dark dark:text-white">
          Gestione Varianti
        </h1>
        <p className="mt-1 text-sm text-dark-6">
          Configura campi e formattazioni per varianti per ogni anagrafica.
        </p>
      </div>

      <InlineAlert notice={notice} onClose={() => setNotice(null)} />

      <SlugPicker value={slug} onChange={setSlug} />

      <VariantsListBox
        anagraficaSlug={slug}
        items={items}
        loading={loading}
        onRefresh={refresh}
        onNotice={setNotice}
      />
    </div>
  );
}
