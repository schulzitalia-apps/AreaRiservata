import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/server-utils/lib/mongoose-connection";
import UserModel from "@/server-utils/models/User";
import { ROLES, AppRole } from "@/types/roles";

/**
 * Endpoint DEV per creare rapidamente un utente. Prova
 * Sicurezza:
 *  - Ora è accessibile anche in produzione.
 *  - Se imposti DEV_SEED_KEY, richiede header x-dev-seed-key con lo stesso valore.
 */
export async function POST(req: NextRequest) {
  // 👇 RIMOSSO IL BLOCCO SU NODE_ENV=production

  const mustKey = process.env.DEV_SEED_KEY;
  if (mustKey) {
    const key = req.headers.get("x-dev-seed-key");
    if (key !== mustKey) {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    }
  }

  const body = await req.json().catch(() => ({}));
  const email = (body.email ?? "").toLowerCase().trim();
  const password = body.password ?? "Password!123";
  const name = body.name ?? null;
  const role = body.role as AppRole | undefined;

  if (!email || !password) {
    return NextResponse.json({ message: "Email e password richieste" }, { status: 400 });
  }
  if (!role || !ROLES.includes(role)) {
    return NextResponse.json({ message: "Ruolo non valido" }, { status: 400 });
  }

  await connectToDatabase();

  const exists = await UserModel.findOne({ email }).lean();
  if (exists) {
    return NextResponse.json({ message: "Utente già esistente" }, { status: 409 });
  }

  // hash via pre('save') nello schema
  const user = await UserModel.create({
    email,
    password,
    role,
    approved: true, // bypass “Utente non approvato” per ambiente dev/prova
    name,
  });

  return NextResponse.json({
    ok: true,
    userId: user._id.toString(),
    email: user.email,
    role: user.role,
  });
}
