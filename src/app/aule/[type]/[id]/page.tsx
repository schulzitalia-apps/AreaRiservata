// src/app/aule/[type]/[id]/page.tsx
import AulaViewer from "@/components/AtlasModuli/Aule/AulaViewer";

export default async function Page({
                                     params,
                                   }: {
  params: Promise<{ type: string; id: string }>;
}) {
  const { type, id } = await params;

  return (
    <div className="p-4">
      <AulaViewer type={type} id={id} />
    </div>
  );
}
