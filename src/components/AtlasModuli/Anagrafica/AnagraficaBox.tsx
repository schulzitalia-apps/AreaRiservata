// src/components/AtlasModuli/anagrafiche/AnagraficaBox.tsx
"use client";

import AnagraficheList from "./AnagraficheList/AnagraficheList";
import { getAnagraficheListUIConfig } from "@/components/AtlasModuli/Anagrafica/AnagraficheList/anagrafiche.list.ui";

export default function AnagraficaBox({ type }: { type: string }) {
  const cfg = getAnagraficheListUIConfig(type);
  return <AnagraficheList type={type} config={cfg ?? {}} />;
}
