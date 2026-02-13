// src/components/AtlasModuli/Calendario/types.ts
"use client";

import type { TimeKind } from "@/components/Store/models/eventi";

export type CalendarEventVM = {
  id: string;
  title: string;
  subtitle: string | null;
  notes: string | null;

  start: string; // ISO
  end: string;   // ISO
  allDay: boolean;

  timeKind: TimeKind;

  visibilityRole: string | null;
  typeSlug: string;
  typeLabel: string;
};
