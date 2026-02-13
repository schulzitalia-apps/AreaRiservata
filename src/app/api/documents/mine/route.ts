// src/app/api/documents/mine/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { connectToDatabase } from "@/server-utils/lib/mongoose-connection";
import DocumentModel from "@/server-utils/models/Document";
import UserModel from "@/server-utils/models/User";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (!token?.id) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const category = (url.searchParams.get("category") || "all") as
    | "all"
    | "orderConfirmation"
    | "technicalDoc"
    | "certification";

  await connectToDatabase();

  // SOLO MIE: privati (ownerId = me) + pubblici creati da me
  const base = {
    $or: [{ ownerId: token.id }, { visibility: "public", createdBy: token.id }],
  } as any;

  if (category !== "all") base.category = category;

  const docs = await DocumentModel.find(base).sort({ updatedAt: -1 }).lean();

  const ownerIds = Array.from(new Set(docs.map((d) => String(d.ownerId || "")).filter(Boolean)));
  const owners = ownerIds.length
    ? await UserModel.find({ _id: { $in: ownerIds } }, { name: 1, email: 1 }).lean()
    : [];
  const ownerMap = new Map(owners.map((u) => [String(u._id), u.name || u.email || "(senza nome)"]));

  return NextResponse.json({
    items: docs.map((d) => ({
      id: String(d._id),
      title: d.title,
      type: d.type,
      visibility: d.visibility,
      sizeKB: Math.round((d.sizeBytes || 0) / 1024),
      updatedAt:
        d.updatedAt instanceof Date
          ? d.updatedAt.toISOString()
          : new Date(d.updatedAt as any).toISOString(),
      owner: d.ownerId
        ? { id: String(d.ownerId), name: ownerMap.get(String(d.ownerId)) || "" }
        : { id: "", name: "" },
      url: d.url || undefined,
      thumbnailUrl: d.thumbnailUrl || undefined,
      summary: d.summary || null,
      category: d.category,
    })),
  });
}
