import type { Metadata } from "next";
import Breadcrumb from "@/components/Breadcrumbs/Breadcrumb";
import ActionMailRulesAdminPanel from "@/components/Admin/ActionMailRulesAdminPanel";

export const metadata: Metadata = {
  title: "Dev / Email per Azioni",
  description: "Associa template email alle azioni automatiche",
};

export default function Page() {
  return (
    <main className="min-h-screen p-6">
      <div className="mx-auto w-full max-w-6xl">
        <Breadcrumb pageName="Dev / Email per Azioni" />
        <div className="mt-4">
          <ActionMailRulesAdminPanel />
        </div>
      </div>
    </main>
  );
}
