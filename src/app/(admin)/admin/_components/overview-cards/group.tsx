import { OverviewCard } from "./card";
import { ActionUsers, ActionDocumentUpload, ActionGroups, ActionMail } from "../icons/dashboard-icons";

export async function OverviewCardsGroup() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 sm:gap-6 xl:grid-cols-4 2xl:gap-7.5">
      <OverviewCard
        label="Utenze"
        actionLabel="Strumento di gestione utenze"
        href="/admin/utenze"
        Icon={ActionUsers}
        fillClassName="bg-sky-500/28 dark:bg-sky-400/20"
      />
      <OverviewCard
        label="Documenti"
        actionLabel="Strumento di gestione documenti"
        href="/admin/documents"
        Icon={ActionDocumentUpload}
        fillClassName="bg-violet-500/28 dark:bg-violet-400/20"
      />
      <OverviewCard
        label="Varianti"
        actionLabel="Strumento di gestione varianti"
        href="/admin/variants"
        Icon={ActionGroups}
        fillClassName="bg-orange-500/28 dark:bg-orange-400/20"
      />
      <OverviewCard
        label="Mail"
        actionLabel="Strumento di gestione mail"
        href="/admin/mail-admin"
        Icon={ActionMail}
        fillClassName="bg-emerald-500/28 dark:bg-emerald-400/20"
      />
    </div>
  );
}
