// src/app/api/eventi/[type]/filter/route.ts

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/server-utils/lib/auth-guards";
import { AppRole } from "@/types/roles";

import { connectToDatabase } from "@/server-utils/lib/mongoose-connection";
import { getEventoDef } from "@/config/eventi.registry";
import { getEventoModel } from "@/server-utils/models/eventi.factory";
import type { IEventoDoc, TimeKind } from "@/server-utils/models/evento.schema";
import UserModel from "@/server-utils/models/User";

import { isAutoEventoVisibleNow } from "@/server-utils/actions-engine/autoEventsVisibility.engine";

export const runtime = "nodejs";

// GET /api/eventi/:type/filter?query=&limit=&visibilityRole=&timeFrom=&timeTo=&anagraficaType=&anagraficaId=&gruppoType=&gruppoId=
export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ type: string }> },
) {
  const auth = await requireAuth(req);
  if (!auth.ok) return auth.res;
  const token = auth.token;

  const userId = (token as any)?.id ?? (token as any)?.sub;
  const role = token.role as AppRole | undefined;
  const isAdmin = role === "Super" || role === "Amministrazione";

  if (!userId) {
    return NextResponse.json(
      { message: "Unauthorized" },
      { status: 401 },
    );
  }

  const { type } = await ctx.params;
  const { searchParams } = new URL(req.url);

  const query = (searchParams.get("query") || "").trim() || undefined;
  const visibilityRole =
    (searchParams.get("visibilityRole") || "").trim() || undefined;

  const timeFrom =
    (searchParams.get("timeFrom") || "").trim() || undefined;
  const timeTo =
    (searchParams.get("timeTo") || "").trim() || undefined;

  const anagraficaType =
    (searchParams.get("anagraficaType") || "").trim() || undefined;
  const anagraficaId =
    (searchParams.get("anagraficaId") || "").trim() || undefined;

  const gruppoType =
    (searchParams.get("gruppoType") || "").trim() || undefined;
  const gruppoId =
    (searchParams.get("gruppoId") || "").trim() || undefined;

  const limitRaw = Number(searchParams.get("limit") || 100);
  const limit =
    Number.isFinite(limitRaw) && limitRaw > 0 ? limitRaw : 100;

  await connectToDatabase();

  const def = getEventoDef(type);
  const Model = getEventoModel(type);

  const conditions: any[] = [];

  // 🔎 ricerca testo sui campi di preview (data.{campo})
  if (query) {
    const q = new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    conditions.push({
      $or: def.preview.searchIn.map((k) => ({ [`data.${k}`]: q })),
    });
  }

  // filtro visibilità esplicita
  if (visibilityRole) {
    conditions.push({ visibilityRole });
  }

  // filtro temporale opzionale
  if (timeFrom || timeTo) {
    const range: any = {};
    if (timeFrom) range.$gte = new Date(timeFrom);
    if (timeTo) range.$lte = new Date(timeTo);
    conditions.push({ startAt: range });
  }

  // filtro per partecipante specifico
  if (anagraficaType && anagraficaId) {
    const mongoose = (await import("mongoose")).default;
    conditions.push({
      partecipanti: {
        $elemMatch: {
          anagraficaType,
          anagraficaId: new mongoose.Types.ObjectId(anagraficaId),
        },
      },
    });
  }

  // filtro per gruppo specifico
  if (gruppoType && gruppoId) {
    const mongoose = (await import("mongoose")).default;
    conditions.push({
      "gruppo.gruppoType": gruppoType,
      "gruppo.gruppoId": new mongoose.Types.ObjectId(gruppoId),
    });
  }

  // 🧠 QUI: solo auto-eventi (cioè quelli creati dal motore actions)
  conditions.push({ _autoEvent: { $ne: null } });

  // ACL: se non admin, solo owner o per ruolo
  if (!isAdmin) {
    const mongoose = (await import("mongoose")).default;
    const ownerId = new mongoose.Types.ObjectId(userId);
    const or: any[] = [{ owner: ownerId }];
    if (role) or.push({ visibilityRole: role });
    conditions.push({ $or: or });
  }

  const filter = conditions.length ? { $and: conditions } : {};

  const mongoose = (await import("mongoose")).default;

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
    .sort({ startAt: 1, updatedAt: -1 })
    .limit(Math.min(limit, 200))
    .lean<IEventoDoc[]>();

  // 🧮 applico il motore di visibilità SOLO qui
  const now = new Date();
  const visibleDocs = docs.filter((m) =>
    isAutoEventoVisibleNow(
      {
        startAt: m.startAt ?? null,
        endAt: m.endAt ?? null,
        _autoEvent: (m as any)._autoEvent ?? null,
      } as any,
      now,
    ),
  );

  // join owner (stesso pattern di listEventi)
  const ownerIds = Array.from(
    new Set(
      visibleDocs
        .map((m: any) => (m.owner ? String(m.owner) : null))
        .filter(Boolean),
    ),
  ) as string[];

  let ownerMap = new Map<string, { name: string; email: string }>();
  if (ownerIds.length) {
    const owners = await UserModel.find(
      {
        _id: {
          $in: ownerIds.map((x) => new mongoose.Types.ObjectId(x)),
        },
      },
      { name: 1, email: 1 },
    ).lean();
    ownerMap = new Map(
      owners.map((u: any) => [
        String(u._id),
        {
          name: u.name || u.email || "(utente)",
          email: u.email || "",
        },
      ]),
    );
  }

  // stessa shape di EventoPreview
  const items = visibleDocs.map((m: any) => {
    const data = m.data || {};

    const joinVals = (keys: string[]) =>
      keys
        .map((k) => data?.[k] ?? "")
        .filter(
          (v) =>
            v !== null &&
            v !== undefined &&
            String(v).trim() !== "",
        )
        .map(String);

    const displayName =
      joinVals(def.preview.title).join(" ") || "(senza titolo)";
    const subtitle =
      joinVals(def.preview.subtitle).join(" · ") || null;

    const ownerIdStr = m.owner ? String(m.owner) : null;
    const ownerInfo = ownerIdStr ? ownerMap.get(ownerIdStr) : undefined;

    return {
      id: String(m._id),
      displayName,
      subtitle,
      timeKind: m.timeKind as TimeKind,
      startAt: m.startAt ? new Date(m.startAt).toISOString() : null,
      endAt: m.endAt ? new Date(m.endAt).toISOString() : null,
      updatedAt: new Date(m.updatedAt).toISOString(),
      visibilityRole: m.visibilityRole || null,
      ownerId: ownerIdStr,
      ownerName: ownerInfo?.name || null,
    };
  });

  return NextResponse.json({ items });
}
