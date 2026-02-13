// src/app/api/calendar/events/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { connectToDatabase } from "@/server-utils/lib/mongoose-connection";
import CalendarEvent from "@/server-utils/models/CalendarEvent";
import { buildRange } from "@/utils/date-utils";
import mongoose from "mongoose";

export const runtime = "nodejs";

function unauthorized() {
  return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
}

// GET /api/calendar/events?from=YYYY-MM-DD&to=YYYY-MM-DD&scope=public|private
export async function GET(req: NextRequest) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (!token?.id) return unauthorized();

  await connectToDatabase();

  const { searchParams } = new URL(req.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const scope = (searchParams.get("scope") || "private") as "public" | "private";

  if (!from || !to) {
    return NextResponse.json({ message: "Parametri 'from' e 'to' richiesti (YYYY-MM-DD)" }, { status: 400 });
  }
  const range = { $lt: new Date(`${to}T23:59:59.999Z`), $gte: new Date(`${from}T00:00:00.000Z`) };

  let query: any = { start: { $lt: range.$lt }, end: { $gt: range.$gte } }; // overlap
  if (scope === "public") {
    query.visibility = "public";
  } else {
    query.visibility = "private";
    query.ownerId = new mongoose.Types.ObjectId(String((token as any).id));
  }

  const events = await CalendarEvent.find(query).sort({ start: 1 }).lean();

  return NextResponse.json({ events }, { status: 200 });
}

// POST /api/calendar/events
// body: { title, notes?, visibility, dateStart, dateEnd?, timeStart?, timeEnd? }
export async function POST(req: NextRequest) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (!token?.id) return unauthorized();
  await connectToDatabase();

  const body = await req.json();
  try {
    const { title, notes, visibility = "private", dateStart, dateEnd, timeStart, timeEnd } = body || {};
    if (!title || !dateStart) throw new Error("title e dateStart sono obbligatori");

    const { start, end, allDay } = buildRange(dateStart, dateEnd, timeStart, timeEnd);

    const doc = await CalendarEvent.create({
      title,
      notes,
      start,
      end,
      allDay,
      visibility,
      ownerId: visibility === "private" ? (token as any).id : undefined,
      createdBy: (token as any).id,
    });

    return NextResponse.json({ event: doc.toObject() }, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ message: e?.message || "Errore creazione evento" }, { status: 400 });
  }
}

// PATCH /api/calendar/events
// body: { id, ...campi (come POST) }
export async function PATCH(req: NextRequest) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (!token?.id) return unauthorized();
  await connectToDatabase();

  const body = await req.json();
  const { id, title, notes, visibility, dateStart, dateEnd, timeStart, timeEnd } = body || {};
  if (!id) return NextResponse.json({ message: "id richiesto" }, { status: 400 });

  const event = await CalendarEvent.findById(id);
  if (!event) return NextResponse.json({ message: "Evento non trovato" }, { status: 404 });

  // permessi: se private, solo il proprietario può editarlo
  const isOwner = String(event.ownerId || event.createdBy) === String((token as any).id);
  if (event.visibility === "private" && !isOwner) return unauthorized();

  try {
    if (title !== undefined) event.title = title;
    if (notes !== undefined) event.notes = notes;
    if (visibility && visibility !== event.visibility) {
      event.visibility = visibility;
      event.ownerId = visibility === "private" ? (token as any).id : undefined;
    }

    if (dateStart || dateEnd || timeStart || timeEnd) {
      const { start, end, allDay } = buildRange(dateStart ?? event.start, dateEnd ?? event.end, timeStart, timeEnd);
      event.start = start; event.end = end; event.allDay = allDay;
    }

    await event.save();
    return NextResponse.json({ event: event.toObject() }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ message: e?.message || "Errore aggiornamento evento" }, { status: 400 });
  }
}

// DELETE /api/calendar/events?id=...
export async function DELETE(req: NextRequest) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (!token?.id) return unauthorized();
  await connectToDatabase();

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ message: "id richiesto" }, { status: 400 });

  const event = await CalendarEvent.findById(id);
  if (!event) return NextResponse.json({ message: "Evento non trovato" }, { status: 404 });

  const isOwner = String(event.ownerId || event.createdBy) === String((token as any).id);
  if (event.visibility === "private" && !isOwner) return unauthorized();

  await event.deleteOne();
  return NextResponse.json({ ok: true }, { status: 200 });
}
