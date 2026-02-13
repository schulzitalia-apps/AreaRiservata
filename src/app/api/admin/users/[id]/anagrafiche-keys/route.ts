// src/app/api/admin/users/[id]/anagrafiche-keys/route.ts
import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { requireAuth } from "@/server-utils/lib/auth-guards";
import type { AnagraficaTypeSlug } from "@/config/anagrafiche.types.public";
import {
  listUserAnagraficaKeysPreview,
  createUserAnagraficaKey,
  deleteUserAnagraficaKey,
} from "@/server-utils/service/anagraficheKeysQuery";

export const runtime = "nodejs";

// GET /api/admin/users/:id/anagrafiche-keys
// -> restituisce le anagrafiche collegate a quell'utente, con preview
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

  const items = await listUserAnagraficaKeysPreview(id);
  return NextResponse.json({ items }, { status: 200 });
}

// POST /api/admin/users/:id/anagrafiche-keys
// body: { anagraficaType: string, anagraficaId: string }
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

  const anagraficaType = (body?.anagraficaType || "").trim();
  const anagraficaId = (body?.anagraficaId || "").trim();

  if (!anagraficaType || !anagraficaId) {
    return NextResponse.json(
      { message: "anagraficaType e anagraficaId sono obbligatori" },
      { status: 400 }
    );
  }

  if (!mongoose.isValidObjectId(id)) {
    return NextResponse.json(
      { message: "Id utente non valido" },
      { status: 400 }
    );
  }

  if (!mongoose.isValidObjectId(anagraficaId)) {
    return NextResponse.json(
      { message: "anagraficaId non è un ObjectId valido" },
      { status: 400 }
    );
  }

  try {
    const created = await createUserAnagraficaKey({
      userId: id,
      anagraficaType: anagraficaType as AnagraficaTypeSlug,
      anagraficaId,
    });

    return NextResponse.json(created, { status: 201 });
  } catch (err: any) {
    if (err?.code === "ANAGRAFICA_NOT_FOUND") {
      return NextResponse.json(
        { message: "Anagrafiche non trovata" },
        { status: 404 }
      );
    }
    if (err?.code === 11000) {
      // violazione unique index → era già collegata
      return NextResponse.json(
        { message: "Questa anagrafica è già associata all'utente" },
        { status: 409 }
      );
    }
    // errori imprevisti: li ributtiamo su Next
    throw err;
  }
}

// DELETE /api/admin/users/:id/anagrafiche-keys
// body: { anagraficaType: string, anagraficaId: string }
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

  const anagraficaType = (body?.anagraficaType || "").trim();
  const anagraficaId = (body?.anagraficaId || "").trim();

  if (!anagraficaType || !anagraficaId) {
    return NextResponse.json(
      { message: "anagraficaType e anagraficaId sono obbligatori" },
      { status: 400 }
    );
  }

  if (!mongoose.isValidObjectId(id)) {
    return NextResponse.json(
      { message: "Id utente non valido" },
      { status: 400 }
    );
  }

  if (!mongoose.isValidObjectId(anagraficaId)) {
    return NextResponse.json(
      { message: "anagraficaId non è un ObjectId valido" },
      { status: 400 }
    );
  }

  const deletedCount = await deleteUserAnagraficaKey({
    userId: id,
    anagraficaType: anagraficaType as AnagraficaTypeSlug,
    anagraficaId,
  });

  if (!deletedCount) {
    return NextResponse.json(
      { message: "Associazione non trovata" },
      { status: 404 }
    );
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}
