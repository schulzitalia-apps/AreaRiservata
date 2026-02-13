// src/app/api/admin/users/list/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { connectToDatabase } from "@/server-utils/lib/mongoose-connection";
import UserModel from "@/server-utils/models/User";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (!token?.id) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const role = (token as any)?.role as string | undefined;
  const isAdmin = role === "Super" || role === "Amministrazione";
  if (!isAdmin) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  await connectToDatabase();
  const users = await UserModel.find({}, { name: 1, email: 1, role: 1 })
    .sort({ name: 1, email: 1 })
    .limit(500)
    .lean();

  return NextResponse.json({
    items: users.map((u) => ({
      id: String(u._id),
      name: u.name || u.email || "(no name)",
      email: u.email || "",
      role: u.role || "Cliente",
    })),
  });
}
