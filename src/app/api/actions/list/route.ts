import { NextRequest, NextResponse } from "next/server";
import { ANAGRAFICHE_ACTIONS } from "@/config/actions.anagrafiche.public";
import { AULE_ACTIONS } from "@/config/actions.aule.public";

export async function GET(_req: NextRequest) {
  // TODO: qui mettici il tuo check admin (session/role)
  const anagrafiche = ANAGRAFICHE_ACTIONS.map((a) => ({
    scope: "ANAGRAFICA" as const,
    id: a.id,
    label: a.label,
    description: a.description ?? null,
    trigger: a.trigger,
    timeKind: a.timeKind,
    timeSource: a.timeSource ?? "field",
    visibility: a.visibility,
    windowDaysBefore: a.windowDaysBefore ?? null,
    windowDaysAfter: a.windowDaysAfter ?? null,
    eventType: a.eventType,
    uiTone: (a as any).uiTone ?? null,
    anagraficaType: a.anagraficaType,
    field: a.field,
  }));

  const aule = AULE_ACTIONS.map((a) => ({
    scope: "AULA" as const,
    id: a.id,
    label: a.label,
    description: a.description ?? null,
    trigger: a.trigger,
    timeKind: a.timeKind,
    timeSource: a.timeSource ?? "field",
    visibility: a.visibility,
    windowDaysBefore: a.windowDaysBefore ?? null,
    windowDaysAfter: a.windowDaysAfter ?? null,
    eventType: a.eventType,
    uiTone: (a as any).uiTone ?? null,
    aulaType: a.aulaType,
    field: a.field,
  }));

  return NextResponse.json({ ok: true, items: [...anagrafiche, ...aule] });
}
