import EventoEdit from "@/components/AtlasModuli/Eventi/EventoEdit";

export default async function Page({
                                     params,
                                   }: {
  params: Promise<{ type: string; id: string }>;
}) {
  const { type, id } = await params;

  return (
    <div className="p-4">
      <EventoEdit type={type} id={id} />
    </div>
  );
}
