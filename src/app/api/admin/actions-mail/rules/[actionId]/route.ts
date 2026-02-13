import { NextResponse } from "next/server";
import mongoose from "mongoose";

import ActionMailRuleModel from "@/server-utils/models/ActionMailRule";

async function ensureDb() {
  if (mongoose.connection.readyState === 1) return;
  const uri = process.env.MONGODB_URI;
  if (!uri) return;
  await mongoose.connect(uri);
}

export async function PUT(
  req: Request,
  ctx: { params: Promise<{ actionId: string }> }
) {
  try {
    // TODO: check permessi admin se ti serve

    await ensureDb();

    const { actionId } = await ctx.params;
    const body = await req.json();

    const enabled = !!body.enabled;
    const sendMode =
      body.sendMode === "ALLA_DATA_EVENTO" ? "ALLA_DATA_EVENTO" : "IMMEDIATO";

    const subjectTemplate = String(body.subjectTemplate ?? "");
    const htmlTemplate = String(body.htmlTemplate ?? "");

    const scope =
      body.scope === "AULA" ? "AULA" : "ANAGRAFICA";

    const doc = await ActionMailRuleModel.findOneAndUpdate(
      { actionId },
      {
        $set: {
          actionId,
          scope,
          enabled,
          sendMode,
          subjectTemplate,
          htmlTemplate,
        },
      },
      { new: true, upsert: true }
    ).lean();

    return NextResponse.json({
      ok: true,
      item: {
        actionId: doc.actionId,
        scope: doc.scope,
        enabled: !!doc.enabled,
        sendMode: doc.sendMode,
        subjectTemplate: doc.subjectTemplate ?? "",
        htmlTemplate: doc.htmlTemplate ?? "",
        updatedAt: doc.updatedAt ? new Date(doc.updatedAt).toISOString() : null,
      },
    });
  } catch (e: any) {
    console.error("[actions-Mail/rules/:actionId] error:", e);
    return NextResponse.json(
      { ok: false, message: e?.message || "Errore interno" },
      { status: 500 }
    );
  }
}
