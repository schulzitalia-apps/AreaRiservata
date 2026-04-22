import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/server-utils/lib/auth-guards";
import { runAnima } from "@/server-utils/anima/runAnima";
import type { AnimaChannel } from "@/server-utils/anima/core/types";
import { loadAnimaUserProfile } from "@/server-utils/anima/context/userProfile";

export const runtime = "nodejs";

function isAnimaChannel(value: string): value is AnimaChannel {
  return (
    value === "internal" ||
    value === "twilio_whatsapp" ||
    value === "meta_whatsapp" ||
    value === "twilio_voice" ||
    value === "telegram"
  );
}

export async function POST(req: NextRequest) {
  const authResult = await requireAuth(req);
  if (!authResult.ok) return authResult.res;

  const body = await req.json().catch(() => ({}));
  const message =
    typeof body?.message === "string" ? body.message.trim() : "";

  if (!message) {
    return NextResponse.json(
      { message: "message is required" },
      { status: 400 },
    );
  }

  const rawChannel =
    typeof body?.channel === "string" ? body.channel.trim() : "internal";
  const channel: AnimaChannel = isAnimaChannel(rawChannel)
    ? rawChannel
    : "internal";
  const sessionId =
    typeof body?.sessionId === "string" && body.sessionId.trim()
      ? body.sessionId.trim()
      : undefined;
  const recentTurns = Array.isArray(body?.recentTurns)
    ? body.recentTurns
        .map((item: any) => ({
          role: item?.role === "assistant" ? "assistant" : "user",
          text: typeof item?.text === "string" ? item.text.trim() : "",
        }))
        .filter((item: { text: string }) => item.text.length > 0)
        .slice(-4)
    : undefined;

  const { auth, token } = authResult;
  const profile = await loadAnimaUserProfile({
    userId: auth.userId,
    fallbackName:
      typeof (token as any)?.name === "string" ? (token as any).name : null,
  });

  const result = await runAnima({
    input: {
      userId: auth.userId,
      message,
      channel,
      language: body?.language === "en" ? "en" : "it",
      sessionId,
      recentTurns,
      user: {
        userId: auth.userId,
        displayName: profile.displayName,
        fullName: profile.fullName,
        email: profile.email,
        phone: profile.phone,
        bio: profile.bio,
        role: auth.role,
        isAuthenticated: true,
      },
      auth: {
        role: auth.role,
        isAdmin: auth.isAdmin,
        keyScopes: auth.keyScopes,
      },
      debugOptions: {
        eventTypeResolver:
          body?.debugOptions?.eventTypeResolver === "includes"
            ? "includes"
            : "catalog_tokens",
      },
    },
  });

  return NextResponse.json(result, { status: 200 });
}
