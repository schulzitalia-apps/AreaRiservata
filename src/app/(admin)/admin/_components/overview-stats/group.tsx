import { compactFormat } from "@/server-utils/lib/format-number";
import { getOverviewData } from "../../fetch";
import { OverviewStatCard } from "./card";
import {
  StatUsers,
  StatDocuments,
  StatGroups,
  StatMail,
} from "../icons/dashboard-icons";

export async function OverviewStatsGroup() {
  const { views, profit, products, users } = await getOverviewData();

  return (
    <div className="grid grid-cols-12 gap-4 md:gap-6 2xl:gap-7.5">
      <div className="col-span-12 xl:col-span-3">
        <OverviewStatCard
          label="Utenze totali"
          value={compactFormat(views.value)}
          growthRate={views.growthRate}
          Icon={StatUsers}
        />
      </div>

      <div className="col-span-12 xl:col-span-3">
        <OverviewStatCard
          label="Documenti caricati"
          value={compactFormat(profit.value)}
          growthRate={profit.growthRate}
          Icon={StatDocuments}
        />
      </div>

      <div className="col-span-12 xl:col-span-3">
        <OverviewStatCard
          label="Numero di gruppi"
          value={compactFormat(products.value)}
          growthRate={products.growthRate}
          Icon={StatGroups}
        />
      </div>

      <div className="col-span-12 xl:col-span-3">
        <OverviewStatCard
          label="Mail inviate"
          value={compactFormat(users.value)}
          growthRate={users.growthRate}
          Icon={StatMail}
        />
      </div>
    </div>
  );
}
