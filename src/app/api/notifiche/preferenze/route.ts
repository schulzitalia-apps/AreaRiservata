// src/app/api/notifiche/preferenze/route.ts

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/server-utils/lib/auth-guards";
import { AppRole } from "@/types/roles";

import { connectToDatabase } from "@/server-utils/lib/mongoose-connection";
import { getEventoDef } from "@/config/eventi.registry";
import { getEventoModel } from "@/server-utils/models/eventi.factory";
import type { IEventoDoc, TimeKind } from "@/server-utils/models/evento.schema";
import UserModel from "@/server-utils/models/User";

import {
  EVENTI_NOTIFICATION_PREFERENCES,
  type EventoNotificationPreference,
} from "@/config/notifiche.eventi.preferences";
import { isEventoVisibleByPreferencesNow } from "@/server-utils/actions-engine/eventPreferencesVisibility.engine";

export const runtime = "nodejs";

// GET /api/notifiche/preferenze?limit=&types=slug,slug
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth.ok) return auth.res;

  const token = auth.token;
  const userId = (token as any)?.id ?? (token as any)?.sub;
  const role = token.role as AppRole | undefined;
  const isAdmin = role === "Super" || role === "Amministrazione";

  if (!userId) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);

  const limitRaw = Number(searchParams.get("limit") || 100);
  const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? limitRaw : 100;

  // opzionale: allowlist di tipi (comma separated)
  const typesParam = (searchParams.get("types") || "").trim();
  const typeAllow = typesParam
    ? new Set(typesParam.split(",").map((s) => s.trim()).filter(Boolean))
    : null;

  await connectToDatabase();
  const mongoose = (await import("mongoose")).default;

  const now = new Date();
  const dayMs = 24 * 60 * 60 * 1000;

  const enabledPrefs = EVENTI_NOTIFICATION_PREFERENCES.filter(
    (p) => p.enabled && (!typeAllow || typeAllow.has(p.slug)),
  );

  const collected: Array<{ type: string; doc: any; pref: EventoNotificationPreference; state?: "UPCOMING" | "PAST" }> = [];

  for (const pref of enabledPrefs) {
    const type = pref.slug;
    const def = getEventoDef(type);
    const Model = getEventoModel(type);

    // finestra garantita “non enorme”, derivata dalla preferenza
    const before = Number(pref.beforeDays ?? 0) || 0;

    const afterRaw = Number(pref.afterDays ?? 0) || 0;
    const afterStop =
      pref.stopAfterDays !== undefined ? Number(pref.stopAfterDays) || 0 : null;
    const after = afterStop !== null ? Math.min(afterRaw, afterStop) : afterRaw;

    const pastDays = pref.includePast
      ? Number(pref.pastDays ?? after ?? 0) || 0
      : 0;

    // buffer tecnico (evita edge di timezone/ora)
    const bufferDays = 2;

    const from = new Date(now.getTime() - (pastDays + bufferDays) * dayMs);
    const to = new Date(now.getTime() + (before + bufferDays) * dayMs);

    const conditions: any[] = [];

    // ✅ solo eventi normali (non auto)
    conditions.push({
      $or: [{ _autoEvent: null }, { _autoEvent: { $exists: false } }],
    });

    // ✅ filtro temporale broad: startAt OR endAt dentro la finestra
    conditions.push({
      $or: [
        { startAt: { $gte: from, $lte: to } },
        { endAt: { $gte: from, $lte: to } },
      ],
    });

    // ACL semplice (come /filter)
    if (!isAdmin) {
      const ownerId = new mongoose.Types.ObjectId(userId);
      const or: any[] = [{ owner: ownerId }];
      if (role) or.push({ visibilityRole: role });
      conditions.push({ $or: or });
    }

    const filter = conditions.length ? { $and: conditions } : {};

    const docs = await Model.find(filter)
      .select({
        data: 1,
        owner: 1,
        updatedAt: 1,
        visibilityRole: 1,
        timeKind: 1,
        startAt: 1,
        endAt: 1,
        _autoEvent: 1,
      })
      .sort({ updatedAt: -1 })
      .limit(Math.min(limit, 200))
      .lean<IEventoDoc[]>();

    // filtro preferenze “soft” ora
    for (const doc of docs as any[]) {
      const res = isEventoVisibleByPreferencesNow(doc, pref, now);
      if (!res.visible) continue;
      collected.push({ type, doc, pref, state: res.state });
    }
  }

  // ordino: più recenti prima usando startAt/endAt/updatedAt
  collected.sort((a, b) => {
    const ad = new Date((a.doc.startAt ?? a.doc.endAt ?? a.doc.updatedAt) as any).getTime() || 0;
    const bd = new Date((b.doc.startAt ?? b.doc.endAt ?? b.doc.updatedAt) as any).getTime() || 0;
    return bd - ad;
  });

  const sliced = collected.slice(0, Math.min(limit, 200));

  // join owner
  const ownerIds = Array.from(
    new Set(
      sliced
        .map((x) => (x.doc.owner ? String(x.doc.owner) : null))
        .filter(Boolean),
    ),
  ) as string[];

  let ownerMap = new Map<string, { name: string; email: string }>();
  if (ownerIds.length) {
    const owners = await UserModel.find(
      { _id: { $in: ownerIds.map((x) => new mongoose.Types.ObjectId(x)) } },
      { name: 1, email: 1 },
    ).lean();

    ownerMap = new Map(
      owners.map((u: any) => [
        String(u._id),
        { name: u.name || u.email || "(utente)", email: u.email || "" },
      ]),
    );
  }

  // build preview items
  const items = sliced.map(({ type, doc, state }) => {
    const def = getEventoDef(type);
    const data = doc.data || {};

    const joinVals = (keys: string[]) =>
      keys
        .map((k) => data?.[k] ?? "")
        .filter((v) => v !== null && v !== undefined && String(v).trim() !== "")
        .map(String);

    const displayName =
      joinVals(def.preview.title as any).join(" ") || "(senza titolo)";
    const subtitle =
      joinVals(def.preview.subtitle as any).join(" · ") || null;

    const ownerIdStr = doc.owner ? String(doc.owner) : null;
    const ownerInfo = ownerIdStr ? ownerMap.get(ownerIdStr) : undefined;

    return {
      id: String(doc._id),
      type,
      category: "preferenze_eventi" as const,
      state: state ?? null, // "UPCOMING" | "PAST"
      displayName,
      subtitle,
      timeKind: doc.timeKind as TimeKind,
      startAt: doc.startAt ? new Date(doc.startAt).toISOString() : null,
      endAt: doc.endAt ? new Date(doc.endAt).toISOString() : null,
      updatedAt: new Date(doc.updatedAt).toISOString(),
      visibilityRole: doc.visibilityRole || null,
      ownerId: ownerIdStr,
      ownerName: ownerInfo?.name || null,
    };
  });

  return NextResponse.json({ items });
}
