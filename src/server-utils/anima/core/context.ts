import { getBaseAnimaCapabilities } from "./capabilities";
import type {
  AnimaContext,
  AnimaRecentTurn,
  AnimaSessionInput,
  AnimaUserContext,
} from "./types";

function buildUserContext(input: AnimaSessionInput): AnimaUserContext {
  return {
    userId: input.user?.userId ?? input.userId,
    displayName: input.user?.displayName ?? null,
    fullName: input.user?.fullName ?? null,
    email: input.user?.email ?? null,
    phone: input.user?.phone ?? null,
    bio: input.user?.bio ?? null,
    role: input.user?.role ?? null,
    isAuthenticated: input.user?.isAuthenticated ?? false,
  };
}

function buildRecentTurns(input: AnimaSessionInput): AnimaRecentTurn[] {
  if (!Array.isArray(input.recentTurns)) return [];

  return input.recentTurns
    .map((item) => ({
      role: (item?.role === "assistant" ? "assistant" : "user") as
        | "assistant"
        | "user",
      text: String(item?.text ?? "").trim(),
    }))
    .filter((item) => item.text.length > 0)
    .slice(-4);
}

export function buildAnimaContext(input: AnimaSessionInput): AnimaContext {
  const user = buildUserContext(input);

  return {
    session: {
      userId: input.userId,
      sessionId: input.sessionId?.trim() || input.userId,
      channel: input.channel,
      language: input.language ?? "it",
    },
    user,
    auth: input.auth,
    debugOptions: input.debugOptions,
    capabilities: getBaseAnimaCapabilities(user),
    recentTurns: buildRecentTurns(input),
    input: {
      message: input.message.trim(),
    },
  };
}
