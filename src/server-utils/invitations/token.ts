import crypto from "crypto";

export function generateInviteToken(): string {
  // 32 bytes => 64 hex chars
  return crypto.randomBytes(32).toString("hex");
}

export function hashInviteToken(token: string): string {
  const pepper = process.env.INVITE_TOKEN_PEPPER ?? "";
  return crypto.createHash("sha256").update(token + pepper).digest("hex");
}
