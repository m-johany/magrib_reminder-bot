/** Minutes from `maghribHHMM` to `nowHHMM` within the same evening, crossing midnight. */
export function minutesSinceMaghrib(maghribHHMM: string, nowHHMM: string): number {
  const toMinutes = (hhmm: string): number => {
    const [h, m] = hhmm.split(":").map((p) => Number.parseInt(p, 10));
    return (h ?? 0) * 60 + (m ?? 0);
  };
  const diff = toMinutes(nowHHMM) - toMinutes(maghribHHMM);
  return (diff + 1440) % 1440;
}

function tzParts(date: Date, timeZone: string, parts: Intl.DateTimeFormatOptions): Intl.DateTimeFormatPart[] {
  return new Intl.DateTimeFormat("en-GB", { timeZone, ...parts }).formatToParts(date);
}

/** Local wall-clock "HH:MM" (h23) of an instant in the given IANA timezone. */
export function formatHHMM(date: Date, timeZone: string): string {
  const p = tzParts(date, timeZone, { hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
  const get = (t: Intl.DateTimeFormatPartTypes) => p.find((x) => x.type === t)?.value ?? "00";
  return `${get("hour")}:${get("minute")}`;
}

/** Local "DD-MM-YYYY" of an instant in the given IANA timezone (Aladhan's date format). */
export function formatDateEn(date: Date, timeZone: string): string {
  const p = tzParts(date, timeZone, { day: "2-digit", month: "2-digit", year: "numeric" });
  const get = (t: Intl.DateTimeFormatPartTypes) => p.find((x) => x.type === t)?.value ?? "";
  return `${get("day")}-${get("month")}-${get("year")}`;
}

/** Local date of the previous day as "DD-MM-YYYY". */
export function previousDateEn(date: Date, timeZone: string): string {
  return formatDateEn(new Date(date.getTime() - 86_400_000), timeZone);
}

/** Local weekday name of the previous day, e.g. "Thursday". */
export function previousWeekdayEn(date: Date, timeZone: string): string {
  const p = tzParts(new Date(date.getTime() - 86_400_000), timeZone, { weekday: "long" });
  return p.find((x) => x.type === "weekday")?.value ?? "";
}
