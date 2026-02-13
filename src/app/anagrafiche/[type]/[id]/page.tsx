// src/app/anagrafiche/[type]/[id]/page.tsx

import AnagraficaViewer from "@/components/AtlasModuli/Anagrafica/AnagraficaViewer";

export default async function Page({
                                     params,
                                   }: {
  params: Promise<{ type: string; id: string }>;
}) {
  const { type, id } = await params;

  return (
    <div className="p-4">
      <AnagraficaViewer type={type} id={id} />
    </div>
  );
}
