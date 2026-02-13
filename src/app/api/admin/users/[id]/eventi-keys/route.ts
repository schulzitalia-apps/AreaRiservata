// src/app/api/admin/users/[id]/eventi-keys/route.ts
import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { requireAuth } from "@/server-utils/lib/auth-guards";
import type { EventoTypeSlug } from "@/config/eventi.types.public";
import {
  listUserEventoKeysPreview,
  createUserEventoKey,
  deleteUserEventoKey,
} from "@/server-utils/service/eventiKeysQuery";

export const runtime = "nodejs";

// GET /api/admin/users/:id/eventi-keys
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

  const items = await listUserEventoKeysPreview(id);
  return NextResponse.json({ items }, { status: 200 });
}

// POST /api/admin/users/:id/eventi-keys
// body: { eventoType: string, eventoId: string }
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

  const eventoType = (body?.eventoType || "").trim();
  const eventoId = (body?.eventoId || "").trim();

  if (!eventoType || !eventoId) {
    return NextResponse.json(
      { message: "eventoType e eventoId sono obbligatori" },
      { status: 400 }
    );
  }

  if (!mongoose.isValidObjectId(id)) {
    return NextResponse.json(
      { message: "Id utente non valido" },
      { status: 400 }
    );
  }

  if (!mongoose.isValidObjectId(eventoId)) {
    return NextResponse.json(
      { message: "eventoId non è un ObjectId valido" },
      { status: 400 }
    );
  }

  try {
    const created = await createUserEventoKey({
      userId: id,
      eventoType: eventoType as EventoTypeSlug,
      eventoId,
    });

    return NextResponse.json(created, { status: 201 });
  } catch (err: any) {
    if (err?.code === "EVENTO_NOT_FOUND") {
      return NextResponse.json(
        { message: "Evento non trovato" },
        { status: 404 }
      );
    }
    if (err?.code === 11000) {
      return NextResponse.json(
        { message: "Questo evento è già associato all'utente" },
        { status: 409 }
      );
    }
    throw err;
  }
}

// DELETE /api/admin/users/:id/eventi-keys
// body: { eventoType: string, eventoId: string }
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

  const eventoType = (body?.eventoType || "").trim();
  const eventoId = (body?.eventoId || "").trim();

  if (!eventoType || !eventoId) {
    return NextResponse.json(
      { message: "eventoType e eventoId sono obbligatori" },
      { status: 400 }
    );
  }

  if (!mongoose.isValidObjectId(id)) {
    return NextResponse.json(
      { message: "Id utente non valido" },
      { status: 400 }
    );
  }

  if (!mongoose.isValidObjectId(eventoId)) {
    return NextResponse.json(
      { message: "eventoId non è un ObjectId valido" },
      { status: 400 }
    );
  }

  const deletedCount = await deleteUserEventoKey({
    userId: id,
    eventoType: eventoType as EventoTypeSlug,
    eventoId,
  });

  if (!deletedCount) {
    return NextResponse.json(
      { message: "Associazione non trovata" },
      { status: 404 }
    );
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}
