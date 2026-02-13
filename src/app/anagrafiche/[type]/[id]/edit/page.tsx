// src/app/anagrafiche/[type]/[id]/edit/page.tsx

import AnagraficaEdit from "@/components/AtlasModuli/Anagrafica/AnagraficaEdit";

export default async function Page({
                                     params,
                                   }: {
  params: Promise<{ type: string; id: string }>;
}) {
  const { type, id } = await params;

  return (
    <div className="p-4">
      <AnagraficaEdit type={type} id={id} />
    </div>
  );
}
