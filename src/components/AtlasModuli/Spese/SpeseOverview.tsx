"use client";

import { useDeferredValue, useMemo, useState, useTransition } from "react";
import { useAnagraficaVariants } from "@/components/AtlasModuli/Anagrafica/variants/useAnagraficaVariants";
import { useReferenceBatchPreviewMulti } from "@/components/AtlasModuli/common/useReferenceBatchPreview";
import { isReferenceField } from "@/config/anagrafiche.fields.catalog";
import { getAnagraficaDef } from "@/config/anagrafiche.registry";

import type { TimeKey } from "./types";
import type { CatKey } from "./speseOverview.category";

import { TIME_OPTIONS } from "./config";
import { euro, formatPct } from "./format";
import { colorForKey } from "./speseOverview.safe";
import { KpiTile, DeltaPill, IconWallet, IconReceipt, IconTrend, IconPie } from "./ui";
import { useSpeseAnalyticsSource } from "./hooks/useSpeseAnalyticsSource";
import { useSpeseMemos } from "./hooks/useSpeseMemos";
import { useSpeseOverviewComputed } from "./hooks/useSpeseOverviewComputed";
import { Header } from "./components/Header";
import { Grid1 } from "./components/Grid1";
import { Grid2 } from "./components/Grid2";

const speseDef = getAnagraficaDef("spese");
const supplierField = speseDef.fields.fornitore;
const supplierReferenceConfig = isReferenceField(supplierField) ? supplierField.reference : null;

export default function SpeseOverview() {
  const [timeKey, setTimeKey] = useState<TimeKey>("anno");
  const [catKey, setCatKey] = useState<CatKey>("all");
  const [q, setQ] = useState("");
  const deferredQ = useDeferredValue(q);
  const [isPending, startTransition] = useTransition();

  const { apiData, apiStatus, apiError } = useSpeseAnalyticsSource(timeKey);
  const { options: variantOptions } = useAnagraficaVariants("spese", true);

  const variantLabelById = useMemo(
    () => Object.fromEntries(variantOptions.map((variant: { variantId: string; label: string }) => [String(variant.variantId), variant.label])) as Record<string, string>,
    [variantOptions],
  );

  const computed = useSpeseOverviewComputed({
    apiData,
    timeKey,
    catKey,
    setCatKey,
    q,
    deferredQ,
    variantLabelById,
  });

  const supplierIds = useMemo(() => {
    if (!supplierReferenceConfig) return [];
    return computed.top10
      .map((row: any) => String(row.supplier ?? ""))
      .filter((id) => /^[a-f0-9]{24}$/i.test(id));
  }, [computed.top10]);

  const supplierPreviewMap = useReferenceBatchPreviewMulti(
    supplierReferenceConfig
      ? [
          {
            fieldKey: "fornitore",
            config: supplierReferenceConfig,
            ids: supplierIds,
          },
        ]
      : [],
  );

  const top10 = useMemo(() => {
    const labels = supplierPreviewMap.fornitore ?? {};
    return computed.top10.map((row: any) => ({
      ...row,
      supplier: labels[String(row.supplier)] ?? row.supplier ?? "—",
    }));
  }, [computed.top10, supplierPreviewMap]);

  const memo = useSpeseMemos(timeKey);
  const catColor = computed.categoryMetaLike[String(catKey)]?.color ?? colorForKey(String(catKey));

  return (
    <>
      <Header
        currentPeriodLabel={computed.currentPeriodLabel}
        timeKey={timeKey}
        setTimeKey={(value) =>
          startTransition(() => {
            setTimeKey(value);
          })
        }
        setCatKeyAll={() => setCatKey("all")}
        isPending={isPending}
        apiStatus={apiStatus}
        apiError={apiError}
        TIME_OPTIONS={TIME_OPTIONS as any}
        insightLine={computed.insightLine}
      />

      <Grid1
        currentPeriodLabel={computed.currentPeriodLabel}
        categoriesPrev={computed.categoriesPrev}
        gaugePercent={computed.gaugePercent}
        gaugeSubtitle={computed.gaugeSubtitle}
        deltaIsUp={computed.deltaIsUp}
        categoriesCurrent={computed.categoriesCurrent}
        donutColors={computed.donutColors as any}
        q={q}
        setQ={setQ}
        deferredQ={deferredQ}
        filteredUpcoming={computed.filteredUpcoming}
        upcomingTotal={computed.upcomingTotal}
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiTile
          title="Totale spese"
          value={euro(computed.currentLordo)}
          sub={`Periodo: ${computed.currentPeriodLabel}`}
          right={<DeltaPill deltaPct={computed.deltaPct} />}
          icon={<IconWallet />}
        />
        <KpiTile
          title="IVA recuperata"
          value={euro(computed.currentIva)}
          sub="Stima periodo corrente"
          icon={<IconReceipt />}
        />
        <KpiTile
          title="Scostamento"
          value={`${computed.deltaAbs >= 0 ? "+" : ""}${euro(computed.deltaAbs)}`}
          sub={`${euro(computed.prevLordo)} nel periodo precedente`}
          right={<DeltaPill deltaPct={computed.deltaPct} showArrow />}
          icon={<IconTrend />}
        />
        <KpiTile
          title="Driver principale"
          value={computed.topCurrent?.label ?? "—"}
          sub={`${formatPct(((computed.topCurrent?.value ?? 0) / Math.max(1, computed.currentLordo)) * 100, 0)} · ${euro(computed.topCurrent?.value ?? 0)}`}
          icon={<IconPie />}
        />
      </div>

      <Grid2
        top10={top10}
        catLabel={computed.catLabel}
        currentPeriodLabel={computed.currentPeriodLabel}
        catKey={catKey}
        setCatKey={setCatKey}
        categoryTabItems={computed.categoryTabItems}
        barSeries={computed.barSeries}
        barColors={computed.barColors}
        catColor={catColor}
        memos={memo.memos}
        memoOpen={memo.memoOpen}
        setMemoOpen={memo.setMemoOpen}
        memoTitle={memo.memoTitle}
        setMemoTitle={memo.setMemoTitle}
        memoDate={memo.memoDate}
        setMemoDate={memo.setMemoDate}
        memoAmount={memo.memoAmount}
        setMemoAmount={memo.setMemoAmount}
        onAddMemo={memo.onAddMemo}
      />
    </>
  );
}


