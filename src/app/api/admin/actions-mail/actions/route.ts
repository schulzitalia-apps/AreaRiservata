import { NextResponse } from "next/server";
import mongoose from "mongoose";

import { ANAGRAFICHE_ACTIONS } from "@/config/actions.anagrafiche.public";
import { AULE_ACTIONS } from "@/config/actions.aule.public";

import ActionMailRuleModel from "@/server-utils/models/ActionMailRule";

// Piccolo ensure DB (senza creare helper nuovi)
// Se tu hai già un tuo connect globale, questo non rompe: fa connect solo se serve.
async function ensureDb() {
  if (mongoose.connection.readyState === 1) return;
  const uri = process.env.MONGODB_URI;
  if (!uri) return; // se nel tuo progetto la connessione è già gestita altrove
  await mongoose.connect(uri);
}

export async function GET() {
  try {
    // TODO: check permessi admin se ti serve

    await ensureDb();

    const rules = await ActionMailRuleModel.find({}).lean();
    const rulesMap = new Map<string, any>();
    for (const r of rules) rulesMap.set(r.actionId, r);

    const items = [
      ...ANAGRAFICHE_ACTIONS.map((a) => ({
        id: a.id,
        scope: "ANAGRAFICA" as const,
        label: a.label,
        description: a.description ?? "",
        anagraficaType: a.anagraficaType,
        aulaType: null,
        field: a.field,
        trigger: a.trigger,
        eventType: a.eventType,
        timeKind: a.timeKind,
        visibility: a.visibility,
        timeSource: a.timeSource ?? "field",
      })),
      ...AULE_ACTIONS.map((a) => ({
        id: a.id,
        scope: "AULA" as const,
        label: a.label,
        description: a.description ?? "",
        anagraficaType: null,
        aulaType: a.aulaType,
        field: a.field,
        trigger: a.trigger,
        eventType: a.eventType,
        timeKind: a.timeKind,
        visibility: a.visibility,
        timeSource: a.timeSource ?? "field",
      })),
    ]
      .map((x) => {
        const r = rulesMap.get(x.id);
        return {
          ...x,
          rule: {
            enabled: r ? !!r.enabled : false,
            sendMode: r?.sendMode ?? "IMMEDIATO",
            subjectTemplate: r?.subjectTemplate ?? "",
            htmlTemplate: r?.htmlTemplate ?? "",
            updatedAt: r?.updatedAt ? new Date(r.updatedAt).toISOString() : null,
          },
        };
      })
      .sort((a, b) => a.label.localeCompare(b.label));

    return NextResponse.json({ ok: true, items });
  } catch (e: any) {
    console.error("[actions-Mail/actions] error:", e);
    return NextResponse.json(
      { ok: false, message: e?.message || "Errore interno" },
      { status: 500 }
    );
  }
}
