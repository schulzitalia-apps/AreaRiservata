// src/app/aule/[type]/[id]/edit/page.tsx
import AulaEdit from "@/components/AtlasModuli/Aule/AulaEdit";

export default async function Page({
                                     params,
                                   }: {
  params: Promise<{ type: string; id: string }>;
}) {
  const { type, id } = await params;

  return (
    <div className="p-4">
      <AulaEdit type={type} id={id} />
    </div>
  );
}
