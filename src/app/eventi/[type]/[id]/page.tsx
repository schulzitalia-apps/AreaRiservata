import EventoViewer from "@/components/AtlasModuli/Eventi/EventoViewer";

export default async function Page({
                                     params,
                                   }: {
  params: Promise<{ type: string; id: string }>;
}) {
  const { type, id } = await params;

  return (
    <div className="p-4">
      <EventoViewer type={type} id={id} />
    </div>
  );
}
