// src/app/aule/[type]/new/page.tsx
import AulaEdit from "@/components/AtlasModuli/Aule/AulaEdit";

export default async function Page({
                                     params,
                                   }: {
  params: Promise<{ type: string }>;
}) {
  const { type } = await params;

  return (
    <div className="p-4">
      <AulaEdit type={type} />
    </div>
  );
}
