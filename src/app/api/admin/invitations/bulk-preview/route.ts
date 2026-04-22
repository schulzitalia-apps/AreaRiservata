import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/server-utils/lib/auth-guards";
import {
  getBulkInviteFieldOptions,
  previewBulkUserInvitations,
} from "@/server-utils/service/bulkUserInvitationsService";

export const runtime = "nodejs";

type Body = {
  sourceKind?: "anagrafica" | "aula";
  sourceType?: string;
  sourceIds?: string[];
  emailFieldKey?: string;
  nameFieldKey?: string;
};

export async function POST(req: NextRequest) {
  const guard = await requireAuth(req);
  if (!guard.ok) return guard.res;
  if (!guard.auth.isAdmin) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as Body;
  if (!body.sourceKind || !body.sourceType || !body.emailFieldKey || !body.nameFieldKey) {
    return NextResponse.json({ message: "Parametri bulk incompleti" }, { status: 400 });
  }

  try {
    const fieldOptions = getBulkInviteFieldOptions(body.sourceKind, body.sourceType);
    const preview = await previewBulkUserInvitations({
      sourceKind: body.sourceKind,
      sourceType: body.sourceType,
      sourceIds: Array.isArray(body.sourceIds) ? body.sourceIds : [],
      emailFieldKey: body.emailFieldKey,
      nameFieldKey: body.nameFieldKey,
    });

    return NextResponse.json({ ok: true, fieldOptions, ...preview });
  } catch (error: any) {
    return NextResponse.json(
      { message: error?.message || "Errore preview bulk" },
      { status: 400 },
    );
  }
}
