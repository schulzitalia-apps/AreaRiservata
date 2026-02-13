// src/app/api/admin/users/[id]/aule-keys/route.ts
import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { requireAuth } from "@/server-utils/lib/auth-guards";
import type { AulaTypeSlug } from "@/config/aule.types.public";
import {
  listUserAulaKeysPreview,
  createUserAulaKey,
  deleteUserAulaKey,
} from "@/server-utils/service/auleKeysQuery";

export const runtime = "nodejs";

// GET /api/admin/users/:id/aule-keys
export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const authResult = await requireAuth(req, {
    roles: ["Super", "Amministrazione"],
  });
  if (!authResult.ok) return authResult.res;

  const { id } = await ctx.params;

  if (!mongoose.isValidObjectId(id)) {
    return NextResponse.json(
      { message: "Id utente non valido" },
      { status: 400 }
    );
  }

  const items = await listUserAulaKeysPreview(id);
  return NextResponse.json({ items }, { status: 200 });
}

// POST /api/admin/users/:id/aule-keys
// body: { aulaType: string, aulaId: string }
export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const authResult = await requireAuth(req, {
    roles: ["Super", "Amministrazione"],
  });
  if (!authResult.ok) return authResult.res;

  const { id } = await ctx.params;
  const body = await req.json().catch(() => ({}));

  const aulaType = (body?.aulaType || "").trim();
  const aulaId = (body?.aulaId || "").trim();

  if (!aulaType || !aulaId) {
    return NextResponse.json(
      { message: "aulaType e aulaId sono obbligatori" },
      { status: 400 }
    );
  }

  if (!mongoose.isValidObjectId(id)) {
    return NextResponse.json(
      { message: "Id utente non valido" },
      { status: 400 }
    );
  }

  if (!mongoose.isValidObjectId(aulaId)) {
    return NextResponse.json(
      { message: "aulaId non è un ObjectId valido" },
      { status: 400 }
    );
  }

  try {
    const created = await createUserAulaKey({
      userId: id,
      aulaType: aulaType as AulaTypeSlug,
      aulaId,
    });

    return NextResponse.json(created, { status: 201 });
  } catch (err: any) {
    if (err?.code === "AULA_NOT_FOUND") {
      return NextResponse.json(
        { message: "Aula non trovata" },
        { status: 404 }
      );
    }
    if (err?.code === 11000) {
      return NextResponse.json(
        { message: "Questa aula è già associata all'utente" },
        { status: 409 }
      );
    }
    throw err;
  }
}

// DELETE /api/admin/users/:id/aule-keys
// body: { aulaType: string, aulaId: string }
export async function DELETE(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const authResult = await requireAuth(req, {
    roles: ["Super", "Amministrazione"],
  });
  if (!authResult.ok) return authResult.res;

  const { id } = await ctx.params;
  const body = await req.json().catch(() => ({}));

  const aulaType = (body?.aulaType || "").trim();
  const aulaId = (body?.aulaId || "").trim();

  if (!aulaType || !aulaId) {
    return NextResponse.json(
      { message: "aulaType e aulaId sono obbligatori" },
      { status: 400 }
    );
  }

  if (!mongoose.isValidObjectId(id)) {
    return NextResponse.json(
      { message: "Id utente non valido" },
      { status: 400 }
    );
  }

  if (!mongoose.isValidObjectId(aulaId)) {
    return NextResponse.json(
      { message: "aulaId non è un ObjectId valido" },
      { status: 400 }
    );
  }

  const deletedCount = await deleteUserAulaKey({
    userId: id,
    aulaType: aulaType as AulaTypeSlug,
    aulaId,
  });

  if (!deletedCount) {
    return NextResponse.json(
      { message: "Associazione non trovata" },
      { status: 404 }
    );
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}
