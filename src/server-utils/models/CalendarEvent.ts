// src/models/CalendarEvent.ts
import mongoose, { Schema, Types, Document, Model } from "mongoose";

export type CalendarVisibility = "public" | "private";

export interface ICalendarEvent {
  title: string;
  notes?: string;
  start: Date;   // ISO begin (inclusive)
  end: Date;     // ISO end (exclusive: fine slot)
  allDay: boolean;
  visibility: CalendarVisibility; // public o private
  ownerId?: Types.ObjectId;       // se private, richiesto
  createdBy: Types.ObjectId;
}

export interface ICalendarEventDoc extends ICalendarEvent, Document {
  _id: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const calendarEventSchema = new Schema<ICalendarEventDoc>(
  {
    title: { type: String, required: true, trim: true, maxlength: 200 },
    notes: { type: String, trim: true, maxlength: 5000 },
    start: { type: Date, required: true },
    end: { type: Date, required: true },
    allDay: { type: Boolean, default: false },
    visibility: { type: String, enum: ["public", "private"], default: "private" },
    ownerId: { type: Schema.Types.ObjectId, ref: "User" },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);

// piccolo guardrail: se private, enforce ownerId
calendarEventSchema.pre("validate", function (next) {
  if (this.visibility === "private" && !this.ownerId) {
    return next(new Error("ownerId richiesto per eventi privati"));
  }
  next();
});

const CalendarEvent: Model<ICalendarEventDoc> =
  (mongoose.models.CalendarEvent as Model<ICalendarEventDoc>) ||
  mongoose.model<ICalendarEventDoc>("CalendarEvent", calendarEventSchema);

export default CalendarEvent;
