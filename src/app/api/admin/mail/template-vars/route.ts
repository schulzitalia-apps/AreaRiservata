import { NextResponse } from "next/server";
import { getAnagraficheList } from "@/config/anagrafiche.registry";

type PlaceholderRow = {
  path: string;
  label: string;
  fieldKey: string;
  fieldType: string;
  hint?: string;
};

export async function GET() {
  try {
    const defs = getAnagraficheList();

    const byType = defs.map((def) => {
      const placeholders: PlaceholderRow[] = Object.entries(def.fields || {}).map(([fieldKey, fieldDef]) => ({
        path: `anagrafica.${fieldKey}`,
        label: fieldDef?.label || fieldKey,
        fieldKey,
        fieldType: fieldDef?.type || "text",
        hint: fieldDef?.hint || "",
      }));

      return {
        slug: def.slug,
        label: def.label,
        placeholders,
      };
    });

    const commonMap = new Map<string, PlaceholderRow & { sources: string[] }>();

    for (const typeDef of byType) {
      for (const row of typeDef.placeholders) {
        const existing = commonMap.get(row.path);
        if (existing) {
          existing.sources.push(typeDef.slug);
          continue;
        }
        commonMap.set(row.path, {
          ...row,
          sources: [typeDef.slug],
        });
      }
    }

    const common = Array.from(commonMap.values()).sort((a, b) => a.label.localeCompare(b.label));

    return NextResponse.json({
      ok: true,
      common,
      byType,
    });
  } catch (error) {
    console.error("GET /api/admin/mail/template-vars error:", error);
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
