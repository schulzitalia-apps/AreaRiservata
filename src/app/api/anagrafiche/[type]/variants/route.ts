import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/server-utils/lib/auth-guards";
import { hasPermission } from "@/server-utils/access/access-engine";
import { AppRole } from "@/types/roles";
import {
  listVariants,
  createVariant,
} from "@/server-utils/service/variantConfigQuery";
import {
  listExportVariants,
  createExportVariant,
} from "@/server-utils/service/exportVariantConfigQuery";

export const runtime = "nodejs";

function isExportScope(req: NextRequest) {
  return new URL(req.url).searchParams.get("scope") === "export";
}

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

  // Manteniamo lo stesso endpoint per coerenza di routing,
  // ma le varianti export restano gestite dal loro service dedicato.
  if (isExportScope(req)) {
    const items = await listExportVariants({ anagraficaSlug: type });
    return NextResponse.json({ items });
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
    if (isExportScope(req)) {
      const created = await createExportVariant({
        anagraficaSlug: type,
        payload: {
          variantId: String(body?.variantId ?? "").trim(),
          label: String(body?.label ?? "").trim(),
          format: body?.format === "xls" ? "xls" : "csv",
          includeFields: Array.isArray(body?.includeFields) ? body.includeFields : [],
          referenceExpansions:
            body?.referenceExpansions && typeof body.referenceExpansions === "object"
              ? body.referenceExpansions
              : undefined,
          filterDateField:
            typeof body?.filterDateField === "string" || body?.filterDateField === null
              ? body.filterDateField
              : undefined,
          filterSelectField:
            typeof body?.filterSelectField === "string" || body?.filterSelectField === null
              ? body.filterSelectField
              : undefined,
          sortDateField:
            typeof body?.sortDateField === "string" || body?.sortDateField === null
              ? body.sortDateField
              : undefined,
          sortDir: body?.sortDir === "desc" ? "desc" : "asc",
        },
        userId,
      });

      return NextResponse.json(created, { status: 201 });
    }

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

    if (
      msg.startsWith("INVALID_FILTER_DATE_FIELD") ||
      msg.startsWith("INVALID_SORT_DATE_FIELD") ||
      msg.startsWith("INVALID_SELECT_FIELD")
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
