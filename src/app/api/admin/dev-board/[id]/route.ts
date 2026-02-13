// src/app/api/admin/dev-board/aa/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import mongoose from "mongoose";
import { connectToDatabase } from "@/server-utils/lib/mongoose-connection";
import DevBoardItemModel, {
  DevItemCategory,
  DevItemStatus,
} from "@/server-utils/models/DevBoardItem";

export const runtime = "nodejs";

function isAdminRole(role?: string | null) {
  return role === "Super" || role === "Amministrazione";
}

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  const userId = (token as any)?.id ?? (token as any)?.sub;
  if (!userId) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const role = (token as any).role as string | undefined;
  if (!isAdminRole(role)) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  const { id } = await ctx.params;
  const body = await req.json().catch(() => ({}));

  await connectToDatabase();

  const payload: any = {};
  if (body.category) {
    payload.category = body.category as DevItemCategory;
  }
  if (body.title !== undefined) {
    payload.title = String(body.title || "").trim();
  }
  if (body.description !== undefined) {
    payload.description = String(body.description || "").trim();
  }
  if (body.status) {
    payload.status = body.status as DevItemStatus;
  }
  if (body.versionTag !== undefined) {
    const v = (body.versionTag || "").trim();
    payload.versionTag = v || null;
  }
  payload.updatedBy = new mongoose.Types.ObjectId(userId);

  const updated = await DevBoardItemModel.findByIdAndUpdate(id, payload, {
    new: true,
  }).lean();

  if (!updated) {
    return NextResponse.json({ message: "Not found" }, { status: 404 });
  }

  return NextResponse.json({
    id: String(updated._id),
    category: updated.category,
    title: updated.title,
    description: updated.description,
    status: updated.status,
    versionTag: updated.versionTag ?? null,
    createdAt: updated.createdAt?.toISOString(),
    updatedAt: updated.updatedAt?.toISOString(),
  });
}

export async function DELETE(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  const userId = (token as any)?.id ?? (token as any)?.sub;
  if (!userId) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const role = (token as any).role as string | undefined;
  if (!isAdminRole(role)) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  const { id } = await ctx.params;

  await connectToDatabase();
  const deleted = await DevBoardItemModel.findByIdAndDelete(id).lean();

  if (!deleted) {
    return NextResponse.json({ message: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true, id });
}
