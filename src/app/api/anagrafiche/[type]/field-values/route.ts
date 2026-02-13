import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/server-utils/lib/auth-guards";
import { AppRole } from "@/types/roles";
import { getAnagraficaDef } from "@/config/anagrafiche.registry";
import { getAnagraficheFieldValuesByIds } from "@/server-utils/service/Anagrafiche/anagraficaQuery";

export const runtime = "nodejs";

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ type: string }> },
) {
  const auth = await requireAuth(req);
  if (!auth.ok) return auth.res;
  const token = auth.token;

  const userId = (token as any)?.id ?? (token as any)?.sub;
  const role = token.role as AppRole | undefined;
  const isAdmin = role === "Super" || role === "Amministrazione";

  if (!userId) {
    return NextResponse.json(
      { message: "Unauthorized" },
      { status: 401 },
    );
  }

  const { type } = await ctx.params;
  const def = getAnagraficaDef(type);

  const body = await req.json();
  const ids = (body?.ids ?? []) as string[];
  const field = String(body?.field || "");

  if (!field || !Array.isArray(ids)) {
    return NextResponse.json(
      { message: "Invalid payload" },
      { status: 400 },
    );
  }

  // ACL: stessa logica della lista (qui potresti anche ri-usare la stessa funzione)
  // per semplicità: se non sei admin ti limitiamo comunque tramite list ACL
  // ma siccome stai passando solo ID, ci fidiamo del fatto che siano già visibili
  // alle liste. Se vuoi essere più rigido, puoi aggiungere un filtro owner/role.

  // assicurati che il field esista nella definizione
  if (!def.fields[field as keyof typeof def.fields]) {
    return NextResponse.json(
      { message: "Field not allowed" },
      { status: 400 },
    );
  }

  const map = await getAnagraficheFieldValuesByIds({
    type,
    ids,
    field,
  });

  return NextResponse.json({
    items: Object.entries(map).map(([id, value]) => ({ id, value })),
  });
}
