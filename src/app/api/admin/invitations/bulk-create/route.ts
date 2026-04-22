import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/server-utils/lib/auth-guards";
import { createBulkUserInvitations } from "@/server-utils/service/bulkUserInvitationsService";
import type { AppRole } from "@/types/roles";

export const runtime = "nodejs";

type Body = {
  sourceKind?: "anagrafica" | "aula";
  sourceType?: string;
  sourceIds?: string[];
  emailFieldKey?: string;
  nameFieldKey?: string;
  role?: AppRole;
  expiresInHours?: number;
  sendEmail?: boolean;
  throttleMs?: number;
};

export async function POST(req: NextRequest) {
  const guard = await requireAuth(req);
  if (!guard.ok) return guard.res;
  if (!guard.auth.isAdmin) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as Body;
  if (
    !body.sourceKind ||
    !body.sourceType ||
    !body.emailFieldKey ||
    !body.nameFieldKey ||
    !body.role
  ) {
    return NextResponse.json({ message: "Parametri bulk incompleti" }, { status: 400 });
  }

  try {
    const result = await createBulkUserInvitations({
      req,
      sourceKind: body.sourceKind,
      sourceType: body.sourceType,
      sourceIds: Array.isArray(body.sourceIds) ? body.sourceIds : [],
      emailFieldKey: body.emailFieldKey,
      nameFieldKey: body.nameFieldKey,
      role: body.role,
      expiresInHours: Number.isFinite(body.expiresInHours)
        ? Math.max(1, body.expiresInHours as number)
        : 48,
      sendEmail: !!body.sendEmail,
      throttleMs: Number.isFinite(body.throttleMs) ? Math.max(0, body.throttleMs as number) : 1500,
      createdByUserId: guard.auth.userId,
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (error: any) {
    return NextResponse.json(
      { message: error?.message || "Errore creazione bulk" },
      { status: 400 },
    );
  }
}
