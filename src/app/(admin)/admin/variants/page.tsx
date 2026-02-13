import VariantsAdmin from "@/components/VariantsAdmin/VariantsAdmin";

export const metadata = {
  title: "Gestione Varianti",
};

export default function VariantsPage() {
  return (
    <main className="min-h-screen p-4 sm:p-6">
      <div className="mx-auto w-full max-w-6xl">
        <VariantsAdmin />
      </div>
    </main>
  );
}
