import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/server-utils/lib/auth-guards";
import { hasPermission } from "@/server-utils/access/access-engine";
import { AppRole } from "@/types/roles";
import {
  listVariants,
  createVariant,
} from "@/server-utils/service/variantConfigQuery";

export const runtime = "nodejs";

// GET /api/anagrafiche/:type/variants
export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ type: string }> },
) {
  const authResult = await requireAuth(req);
  if (!authResult.ok) return authResult.res;

  const { auth } = authResult;
  const { type } = await ctx.params;

  // permesso di lettura su quello slug
  if (!hasPermission(auth, "anagrafica.view", { resourceType: type })) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  const items = await listVariants({ anagraficaSlug: type });
  return NextResponse.json({ items });
}

// POST /api/anagrafiche/:type/variants
export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ type: string }> },
) {
  const authResult = await requireAuth(req);
  if (!authResult.ok) return authResult.res;

  const token = (authResult as any).token;
  const userId = (token as any)?.id ?? (token as any)?.sub;
  const role = token?.role as AppRole | undefined;
  const isAdmin = role === "Super" || role === "Amministrazione";

  if (!userId) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  if (!isAdmin) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  const { auth } = authResult;
  const { type } = await ctx.params;

  // (opzionale ma coerente con le tue anagrafiche) anche qui richiediamo view sullo slug
  // così almeno non crei varianti su slug che non puoi nemmeno vedere.
  if (!hasPermission(auth, "anagrafica.view", { resourceType: type })) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();

  try {
    const created = await createVariant({
      anagraficaSlug: type,
      payload: {
        variantId: String(body?.variantId ?? "").trim(),
        label: String(body?.label ?? "").trim(),
        includeFields: Array.isArray(body?.includeFields) ? body.includeFields : [],
        fieldOverrides:
          body?.fieldOverrides && typeof body.fieldOverrides === "object"
            ? body.fieldOverrides
            : undefined,
      },
      userId,
    });

    return NextResponse.json(created, { status: 201 });
  } catch (err: any) {
    // mapping errori dal service
    const msg = err?.message ? String(err.message) : "Bad Request";

    if (msg === "VARIANT_ID_REQUIRED") {
      return NextResponse.json({ message: msg }, { status: 400 });
    }

    if (msg.startsWith("INVALID_FIELDS") || err?.code === "INVALID_FIELDS") {
      return NextResponse.json({ message: msg }, { status: 400 });
    }

    if (
      msg.startsWith("OVERRIDES_NOT_INCLUDED") ||
      err?.code === "OVERRIDES_NOT_INCLUDED"
    ) {
      return NextResponse.json({ message: msg }, { status: 400 });
    }

    // dup unique (slug + variantId)
    if (err?.code === 11000) {
      return NextResponse.json(
        { message: "VARIANT_ALREADY_EXISTS" },
        { status: 409 },
      );
    }

    return NextResponse.json({ message: msg }, { status: 400 });
  }
}
