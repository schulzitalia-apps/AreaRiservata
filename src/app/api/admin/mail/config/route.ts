// src/app/api/admin/Mail/config/route.ts
import { NextRequest, NextResponse } from "next/server";

function parseEmailFromEnv(emailFrom: string | undefined) {
  const raw = (emailFrom || "").trim();
  // supporta: "Name <a@b.it>" oppure "a@b.it"
  const match = raw.match(/<([^>]+)>/);
  const email = (match?.[1] || raw).trim();
  const [localPart, domain] = email.split("@");
  const name = match ? raw.split("<")[0].trim().replace(/^"|"$/g, "") : "";
  return {
    ok: !!localPart && !!domain,
    name: name || undefined,
    email,
    localPart,
    domain,
  };
}

export async function GET(req: NextRequest) {
  try {
    // TODO: auth/role check (admin)

    const parsed = parseEmailFromEnv(process.env.EMAIL_FROM);

    if (!parsed.ok) {
      return NextResponse.json(
        { ok: false, error: "EMAIL_FROM_INVALID" },
        { status: 500 }
      );
    }

    // “system” riservato = localPart preso da EMAIL_FROM
    return NextResponse.json({
      ok: true,
      domain: parsed.domain,
      reservedLocalPart: parsed.localPart, // es: "system"
      defaultFromName: parsed.name,        // es: "SchulzAreaRiservata"
      defaultFromEmail: parsed.email,      // es: "system@schulzitalia.it"
    });
  } catch (e) {
    console.error("Mail/config error:", e);
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
