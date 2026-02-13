import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import mongoose from "mongoose";
import { connectToDatabase } from "@/server-utils/lib/mongoose-connection";
import UserModel from "@/server-utils/models/User";
import { ROLES, AppRole } from "@/types/roles";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

async function getAdmin(req: NextRequest) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (!token?.id) return null;
  const role = (token as any)?.role as string | undefined;
  const isAdmin = role === "Super" || role === "Amministrazione";
  return { userId: String((token as any)?.id ?? (token as any)?.sub), role, isAdmin };
}

// PATCH /api/admin/users/:id  -> aggiorna ruolo
export async function PATCH(req: NextRequest, ctx: Ctx) {
  const auth = await getAdmin(req);
  if (!auth) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }
  if (!auth.isAdmin) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  const { id } = await ctx.params;
  if (!mongoose.isValidObjectId(id)) {
    return NextResponse.json({ message: "Invalid id" }, { status: 400 });
  }

  const body = await req.json().catch(() => ({}));
  const role = body.role as AppRole | undefined;

  if (!role || !ROLES.includes(role)) {
    return NextResponse.json({ message: "Ruolo non valido" }, { status: 400 });
  }

  await connectToDatabase();

  const user = await UserModel.findById(id).lean();
  if (!user) {
    return NextResponse.json({ message: "Not found" }, { status: 404 });
  }

  if (user.role === "Super") {
    return NextResponse.json(
      { message: "Non è possibile modificare un utente Super" },
      { status: 400 }
    );
  }

  await UserModel.updateOne({ _id: id }, { $set: { role } });

  return NextResponse.json({ ok: true, id, role });
}

// DELETE /api/admin/users/:id  -> elimina utente
export async function DELETE(req: NextRequest, ctx: Ctx) {
  const auth = await getAdmin(req);
  if (!auth) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }
  if (!auth.isAdmin) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  const { id } = await ctx.params;
  if (!mongoose.isValidObjectId(id)) {
    return NextResponse.json({ message: "Invalid id" }, { status: 400 });
  }

  await connectToDatabase();

  const user = await UserModel.findById(id).lean();
  if (!user) {
    return NextResponse.json({ message: "Not found" }, { status: 404 });
  }

  if (user.role === "Super") {
    return NextResponse.json(
      { message: "Non è possibile eliminare un utente Super" },
      { status: 400 }
    );
  }

  await UserModel.deleteOne({ _id: id });

  return NextResponse.json({ ok: true, id });
}
