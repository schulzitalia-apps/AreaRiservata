// src/app/anagrafiche/[type]/page.tsx

import AnagraficaBox from "@/components/AtlasModuli/Anagrafica/AnagraficaBox";

export default async function Page({
                                     params,
                                   }: {
  params: Promise<{ type: string }>;
}) {
  const { type } = await params;

  return <AnagraficaBox type={type} />;
}
