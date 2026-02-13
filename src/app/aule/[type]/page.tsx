// src/app/aule/[type]/page.tsx
import AulaBox from "@/components/AtlasModuli/Aule/AulaBox";

export default async function Page({
                                     params,
                                   }: {
  params: Promise<{ type: string }>;
}) {
  const { type } = await params;

  return (
    <div className="p-4">
      <AulaBox type={type} />
    </div>
  );
}
