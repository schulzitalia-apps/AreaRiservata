// src/store/models/calendar.ts

export type CalendarEvent = {
  _id: string;
  title: string;
  notes?: string;
  start: string;   // ISO
  end: string;     // ISO
  allDay: boolean;
  visibility: "public" | "private";
  ownerId?: string;
  createdBy: string;
};

export type Scope = "public" | "private";
