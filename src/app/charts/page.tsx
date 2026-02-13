import { RadialGauge, type TimeframeOption } from "@/components/Charts/radial-gauge";

type TF = "monthly" | "quarterly" | "semiannual" | "yearly";

export default async function ChartsPlaygroundPage() {
  const options: TimeframeOption<TF>[] = [
    { key: "monthly", label: "Mese", subLabel: "mese" },
    { key: "quarterly", label: "Trimestre", subLabel: "trimestre" },
    { key: "semiannual", label: "Semestre", subLabel: "semestre" },
    { key: "yearly", label: "Anno", subLabel: "anno" },
  ];

  const data = {
    monthly: { value: 12, subtitle: "Quanto tempo è necessario per i nostri power-up" },
    quarterly: { value: 61, subtitle: "Vista trimestrale" },
    semiannual: { value: 80, subtitle: "Vista semestrale" },
    yearly: { value: 67, subtitle: "Vista annuale" },
  } satisfies Record<TF, { value: number; subtitle?: string }>;

  return (
    <div className="min-h-[calc(100vh-120px)] px-4 py-10">
      <div className="mx-auto w-full max-w-5xl">
        <RadialGauge
          title="Scalabilità di un altro Mondo"
          subtitle="Quanto tempo è necessario per i nostri power-up"
          options={options}
          data={data}
          defaultKey="monthly"
          size="jumbo"
          className="w-full"
        />
      </div>
    </div>
  );
}
