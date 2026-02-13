// src/app/anagrafiche/[type]/new/page.tsx

import AnagraficaEdit from "@/components/AtlasModuli/Anagrafica/AnagraficaEdit";

export default async function Page({
                                     params,
                                   }: {
  params: Promise<{ type: string }>;
}) {
  const { type } = await params;

  return (
    <div className="p-4">
      {/* Nuova scheda: nessun id, nessun initial */}
      <AnagraficaEdit type={type} />
    </div>
  );
}
