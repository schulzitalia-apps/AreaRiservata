import EventoEdit from "@/components/AtlasModuli/Eventi/EventoEdit";

export default async function Page({
                                     params,
                                   }: {
  params: Promise<{ type: string }>;
}) {
  const { type } = await params;

  return (
    <div className="p-4">
      <EventoEdit type={type} />
    </div>
  );
}
