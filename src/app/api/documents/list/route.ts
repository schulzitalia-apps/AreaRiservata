// src/app/api/admin/documents/list/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { connectToDatabase } from "@/server-utils/lib/mongoose-connection";
import DocumentModel from "@/server-utils/models/Document";
import UserModel from "@/server-utils/models/User";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (!token?.id) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  if ((token as any).role !== "Super" && (token as any).role !== "admin") {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  const url = new URL(req.url);
  const scope = (url.searchParams.get("scope") || "all") as "all" | "public" | "byOwner";
  const ownerId = url.searchParams.get("ownerId") || undefined;

  await connectToDatabase();

  const q: any = {};
  if (scope === "public") q.visibility = "public";
  if (scope === "byOwner" && ownerId) q.ownerId = ownerId;

  const docs = await DocumentModel.find(q).sort({ updatedAt: -1 }).lean();

  const ownerIds = Array.from(new Set(docs.map((d) => String(d.ownerId || "")).filter(Boolean)));
  const owners =
    ownerIds.length > 0 ? await UserModel.find({ _id: { $in: ownerIds } }, { name: 1, email: 1 }).lean() : [];
  const ownerMap = new Map(owners.map((u) => [String(u._id), u.name || u.email || "(senza nome)"]));

  return NextResponse.json({
    items: docs.map((d) => ({
      id: String(d._id),
      title: d.title,
      type: d.type,
      visibility: d.visibility,
      sizeKB: Math.round((d.sizeBytes || 0) / 1024),
      updatedAt:
        d.updatedAt instanceof Date ? d.updatedAt.toISOString() : new Date(d.updatedAt as any).toISOString(),
      owner: d.ownerId ? { id: String(d.ownerId), name: ownerMap.get(String(d.ownerId)) || "" } : { id: "", name: "" },
      url: d.url || undefined,
      thumbnailUrl: d.thumbnailUrl || undefined,
      summary: d.summary || null,
      category: d.category,   // ⬅️ torna fuori
    })),
  });
}
