// src/app/api/admin/documents/list/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { connectToDatabase } from "@/server-utils/lib/mongoose-connection";
import DocumentModel from "@/server-utils/models/Document";
import UserModel from "@/server-utils/models/User";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  // Assumi che il middleware blocchi i non-admin.
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (!token?.id) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const scope = (searchParams.get("scope") || "all") as
    | "all"
    | "public"
    | "byOwner";
  const ownerId = searchParams.get("ownerId") || null;

  await connectToDatabase();

  let query: any = {};
  if (scope === "public") {
    query = { visibility: "public" };
  } else if (scope === "byOwner" && ownerId) {
    query = { ownerId };
  } else {
    query = {};
  }

  const docs = await DocumentModel.find(query).sort({ updatedAt: -1 }).lean();

  const ownerIds = Array.from(
    new Set(docs.map((d: any) => String(d.ownerId || "")).filter(Boolean))
  );

  const owners = ownerIds.length
    ? await UserModel.find(
      { _id: { $in: ownerIds } },
      { name: 1, email: 1 }
    ).lean()
    : [];

  const ownerMap = new Map(
    owners.map((u: any) => [
      String(u._id),
      u.name || u.email || "(senza nome)",
    ])
  );

  return NextResponse.json({
    items: docs.map((d: any) => ({
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

      // ✅ FIX: includi category (e volendo filename se esiste nel model)
      category: d.category || undefined,
      filename: d.filename || undefined,
    })),
  });
}
