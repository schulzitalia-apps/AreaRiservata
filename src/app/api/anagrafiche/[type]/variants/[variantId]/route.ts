import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/server-utils/lib/auth-guards";
import { hasPermission } from "@/server-utils/access/access-engine";
import { AppRole } from "@/types/roles";
import {
  getVariant,
  updateVariant,
  deleteVariant,
} from "@/server-utils/service/variantConfigQuery";
import {
  getExportVariant,
  updateExportVariant,
  deleteExportVariant,
} from "@/server-utils/service/exportVariantConfigQuery";

export const runtime = "nodejs";

function decodeParam(x: string) {
  try {
    return decodeURIComponent(x);
  } catch {
    return x;
  }
}

function isExportScope(req: NextRequest) {
  return new URL(req.url).searchParams.get("scope") === "export";
}

// GET /api/anagrafiche/:type/variants/:variantId
export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ type: string; variantId: string }> },
) {
  const authResult = await requireAuth(req);
  if (!authResult.ok) return authResult.res;

  const { auth } = authResult;
  const { type, variantId } = await ctx.params;

  // permesso di lettura su quello slug
  if (!hasPermission(auth, "anagrafica.view", { resourceType: type })) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  const data = isExportScope(req)
    ? await getExportVariant({
        anagraficaSlug: type,
        variantId: decodeParam(variantId),
      })
    : await getVariant({
        anagraficaSlug: type,
        variantId: decodeParam(variantId),
      });

  if (!data) {
    return NextResponse.json({ message: "Not found" }, { status: 404 });
  }

  return NextResponse.json(data);
}

// PATCH /api/anagrafiche/:type/variants/:variantId
export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ type: string; variantId: string }> },
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
  const { type, variantId } = await ctx.params;

  // (coerente) richiediamo almeno view su quello slug
  if (!hasPermission(auth, "anagrafica.view", { resourceType: type })) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();

  try {
    const updated = isExportScope(req)
      ? await updateExportVariant({
          anagraficaSlug: type,
          variantId: decodeParam(variantId),
          payload: {
            label: typeof body?.label === "string" ? body.label : undefined,
            format: body?.format === "xls" || body?.format === "csv" ? body.format : undefined,
            includeFields: Array.isArray(body?.includeFields)
              ? body.includeFields
              : undefined,
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
            sortDir: body?.sortDir === "desc" || body?.sortDir === "asc"
              ? body.sortDir
              : undefined,
          },
          userId,
        })
      : await updateVariant({
          anagraficaSlug: type,
          variantId: decodeParam(variantId),
          payload: {
            label: typeof body?.label === "string" ? body.label : undefined,
            includeFields: Array.isArray(body?.includeFields)
              ? body.includeFields
              : undefined,
            fieldOverrides:
              body?.fieldOverrides && typeof body.fieldOverrides === "object"
                ? body.fieldOverrides
                : undefined,
          },
          userId,
        });

    if (!updated) {
      return NextResponse.json({ message: "Not found" }, { status: 404 });
    }

    return NextResponse.json(updated);
  } catch (err: any) {
    const msg = err?.message ? String(err.message) : "Bad Request";

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

    if (err?.code === 11000) {
      return NextResponse.json(
        { message: "VARIANT_ALREADY_EXISTS" },
        { status: 409 },
      );
    }

    return NextResponse.json({ message: msg }, { status: 400 });
  }
}

// DELETE /api/anagrafiche/:type/variants/:variantId
export async function DELETE(
  req: NextRequest,
  ctx: { params: Promise<{ type: string; variantId: string }> },
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
  const { type, variantId } = await ctx.params;

  // (coerente) richiediamo almeno view su quello slug
  if (!hasPermission(auth, "anagrafica.view", { resourceType: type })) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  const result = isExportScope(req)
    ? await deleteExportVariant({
        anagraficaSlug: type,
        variantId: decodeParam(variantId),
      })
    : await deleteVariant({
        anagraficaSlug: type,
        variantId: decodeParam(variantId),
      });

  if (!result.ok) {
    return NextResponse.json({ message: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
