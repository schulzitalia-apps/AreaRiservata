import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/server-utils/lib/auth-guards";
import { ANIMA_COMPONENT_CONFIG } from "@/server-utils/anima/core/anima.config";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const authResult = await requireAuth(req);
  if (!authResult.ok) return authResult.res;

  const formData = await req.formData().catch(() => null);
  const audio = formData?.get("audio");

  if (!(audio instanceof File)) {
    return NextResponse.json(
      { message: "audio file is required" },
      { status: 400 },
    );
  }

  if (!process.env.GROQ_API_KEY) {
    return NextResponse.json(
      { message: "GROQ_API_KEY is required" },
      { status: 500 },
    );
  }

  const upstream = new FormData();
  upstream.append("file", audio, audio.name || "audio.webm");
  upstream.append(
    "model",
    ANIMA_COMPONENT_CONFIG.models.speechToText.model ?? "whisper-large-v3-turbo",
  );
  upstream.append("language", "it");
  upstream.append("response_format", "verbose_json");

  const res = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
    },
    body: upstream,
  });

  const data: any = await res.json().catch(() => ({}));
  if (!res.ok) {
    return NextResponse.json(
      {
        message: data?.error?.message || "transcription_failed",
        upstream: data,
      },
      { status: 500 },
    );
  }

  return NextResponse.json(
    {
      text: String(data?.text ?? "").trim(),
      language: data?.language || "it",
      duration: data?.duration ?? null,
      raw: data,
    },
    { status: 200 },
  );
}
