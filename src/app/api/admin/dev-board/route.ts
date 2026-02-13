// src/app/api/admin/dev-board/route.ts
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

/** GET /api/admin/dev-board?category=bug&status=open */
export async function GET(req: NextRequest) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (!token?.id) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const role = (token as any).role as string | undefined;
  if (!isAdminRole(role)) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const category = (searchParams.get("category") || "").trim() as
    | DevItemCategory
    | "";
  const status = (searchParams.get("status") || "").trim() as
    | DevItemStatus
    | "";
  const limit = Math.min(Number(searchParams.get("limit") || 200), 500);

  await connectToDatabase();

  const filter: any = {};
  if (category) filter.category = category;
  if (status) filter.status = status;

  const items = await DevBoardItemModel.find(filter)
    .sort({ createdAt: -1 })
    .limit(limit)
    .populate({ path: "createdBy", select: "name email role" })
    .lean();

  return NextResponse.json({
    items: items.map((i: any) => ({
      id: String(i._id),
      category: i.category as DevItemCategory,
      title: i.title as string,
      description: i.description as string,
      status: i.status as DevItemStatus,
      versionTag: i.versionTag || null,
      createdAt: i.createdAt?.toISOString(),
      updatedAt: i.updatedAt?.toISOString(),
      createdBy: i.createdBy
        ? {
          id: String(i.createdBy._id),
          name: i.createdBy.name || i.createdBy.email || "",
          email: i.createdBy.email || "",
          role: i.createdBy.role || null,
        }
        : null,
    })),
  });
}

/** POST /api/admin/dev-board  (JSON body) */
export async function POST(req: NextRequest) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  const userId = (token as any)?.id ?? (token as any)?.sub;
  if (!userId) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const role = (token as any).role as string | undefined;
  if (!isAdminRole(role)) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const category = body.category as DevItemCategory;
    const title = (body.title || "").trim();
    const description = (body.description || "").trim();
    const versionTag = (body.versionTag || "").trim() || null;

    if (!category || !["bug", "feature", "training", "note"].includes(category)) {
      return NextResponse.json({ message: "Categoria non valida" }, { status: 400 });
    }
    if (!title || !description) {
      return NextResponse.json(
        { message: "Titolo e descrizione sono obbligatori" },
        { status: 400 }
      );
    }

    await connectToDatabase();
    const creator = new mongoose.Types.ObjectId(userId);

    const created = await DevBoardItemModel.create({
      category,
      title,
      description,
      status: "open",
      versionTag,
      createdBy: creator,
      updatedBy: creator,
    });

    return NextResponse.json(
      {
        id: String(created._id),
        category: created.category,
        title: created.title,
        description: created.description,
        status: created.status,
        versionTag: created.versionTag ?? null,
        createdAt: created.createdAt.toISOString(),
        updatedAt: created.updatedAt.toISOString(),
      },
      { status: 201 }
    );
  } catch (e: any) {
    console.error("[dev-board/POST] error", e);
    return NextResponse.json(
      { message: e?.message || "Create failed" },
      { status: 400 }
    );
  }
}
