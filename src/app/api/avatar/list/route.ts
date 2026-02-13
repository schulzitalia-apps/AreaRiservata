// src/app/api/avatar/list/route.ts
import { NextResponse } from "next/server";
import fs from "node:fs/promises";
import path from "node:path";

export const runtime = "nodejs"; // così puoi usare fs

export async function GET() {
  const baseDir = path.join(process.cwd(), "public", "images", "user");

  const files = await fs.readdir(baseDir);

  const images = files
    .filter((f) => /\.(png|jpe?g|gif|webp)$/i.test(f))
    .map((f) => `/images/user/${f}`);

  return NextResponse.json({ images });
}
