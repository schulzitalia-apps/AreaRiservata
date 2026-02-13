import PreventivoBuilder from "@/components/AtlasModuli/Preventivatore/PreventivoBuilder";

export default async function PreventivoEditPage({
                                                   params,
                                                 }: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <PreventivoBuilder preventivoId={id} />;
}
