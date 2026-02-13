// src/lib/date-utils.ts
export function startOfDay(d: Date) { const x = new Date(d); x.setHours(0,0,0,0); return x; }
export function addDays(d: Date, days: number) { const x = new Date(d); x.setDate(x.getDate()+days); return x; }
export function iso(d: Date | string | number) { return new Date(d).toISOString(); }

/** Costruisce [start,end) a partire da mock + opzionali orari (HH:mm). */
export function buildRange(dateStart: string, dateEnd?: string, timeStart?: string, timeEnd?: string) {
  const ds = new Date(dateStart);
  const de = new Date(dateEnd || dateStart);
  const withTimes = timeStart && timeEnd;

  if (withTimes) {
    const [hs, ms] = timeStart!.split(":").map(Number);
    const [he, me] = timeEnd!.split(":").map(Number);
    const s = new Date(ds); s.setHours(hs, ms || 0, 0, 0);
    const e = new Date(de); e.setHours(he, me || 0, 0, 0);
    if (e <= s) throw new Error("L'orario di fine deve essere dopo l'inizio");
    return { start: s, end: e, allDay: false };
  } else {
    const s = startOfDay(ds);
    const e = addDays(startOfDay(de), 1); // end esclusivo
    return { start: s, end: e, allDay: true };
  }
}
