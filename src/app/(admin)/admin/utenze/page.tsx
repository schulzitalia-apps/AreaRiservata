import DevQuickUser from "@/components/Auth/DevQuickUser";

export const metadata = {
  title: "Dev Quick User",
};

export default function DevQuickUserPage() {
  return (
    <main className="min-h-screen p-4 sm:p-6">
      {/* più largo e centrato */}
      <div className="mx-auto w-full max-w-6xl">
        <DevQuickUser />
      </div>
    </main>
  );
}
