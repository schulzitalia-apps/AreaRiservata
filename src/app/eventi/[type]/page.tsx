import EventoBox from "@/components/AtlasModuli/Eventi/EventoBox";

export default async function Page({
                                     params,
                                   }: {
  params: Promise<{ type: string }>;
}) {
  const { type } = await params;

  return (
    <div className="p-4">
      <EventoBox type={type} />
    </div>
  );
}
