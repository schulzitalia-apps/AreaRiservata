// src/app/anagrafiche/page.tsx
import Link from "next/link";
import { getAnagraficheList } from "@/config/anagrafiche.registry";

export default function AnagraficheIndexPage() {
  const list = getAnagraficheList();

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold mb-4">Anagrafiche</h1>

      <div className="grid gap-3 md:grid-cols-2">
        {list.map((def) => (
          <Link
            key={def.slug}
            href={`/anagrafiche/${def.slug}`}
            className="rounded-lg border border-stroke bg-white p-4 text-sm hover:bg-gray-2/60 dark:border-dark-3 dark:bg-gray-dark dark:hover:bg-dark-2/60"
          >
            <div className="flex items-center gap-2">
              <def.icon className="h-5 w-5" />
              <span className="font-medium">{def.label}</span>
            </div>
            <div className="mt-1 text-xs text-dark/60 dark:text-white/60">
              {def.collection}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
