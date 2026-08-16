export interface PrayerTimes {
  maghrib: string; // "HH:MM" 24-hour, e.g. "19:45"
  weekdayEn: string; // e.g. "Thursday"
  dateEn: string; // "DD-MM-YYYY" gregorian
  timezone: string; // IANA, e.g. "Europe/London"
}

export class AladhanError extends Error {}
export class CityNotFoundError extends Error {}

interface AladhanResponse {
  code: number;
  status: string;
  data?: {
    timings?: { Maghrib?: string };
    date?: { gregorian?: { date?: string; weekday?: { en?: string } } };
    meta?: { timezone?: string };
  };
}

export async function fetchPrayerTimes(
  city: string,
  country: string,
  dateEn?: string
): Promise<PrayerTimes> {
  const url = new URL("https://api.aladhan.com/v1/timingsByCity");
  url.searchParams.set("city", city);
  url.searchParams.set("country", country);
  url.searchParams.set("method", "2"); // ISNA
  if (dateEn) {
    url.searchParams.set("date", dateEn);
  }

  const res = await fetch(url);
  let body: AladhanResponse | string;
  try {
    body = (await res.json()) as AladhanResponse;
  } catch {
    throw new AladhanError(`Aladhan returned non-JSON (HTTP ${res.status})`);
  }

  if (res.status === 400) {
    throw new CityNotFoundError();
  }
  if (!res.ok) {
    throw new AladhanError(`Aladhan HTTP ${res.status}`);
  }
  if (typeof body === "string") {
    throw new AladhanError("Aladhan returned unexpected body");
  }
  if (body.code !== 200 || body.status !== "OK" || !body.data) {
    // Aladhan reports unknown cities as 200 + status ERROR ("Unable to
    // compute prayer times..."). Anything else is a service-side error.
    const errorData = body.data as unknown;
    if (typeof errorData === "string" && errorData.includes("Unable to compute")) {
      throw new CityNotFoundError();
    }
    throw new AladhanError(`Aladhan error response: ${body.status}`);
  }

  const { timings, date, meta } = body.data;
  const maghrib = timings?.Maghrib;
  const weekdayEn = date?.gregorian?.weekday?.en;
  const dateEnOut = date?.gregorian?.date;
  const timezone = meta?.timezone;
  if (!maghrib || !weekdayEn || !dateEnOut || !timezone) {
    throw new AladhanError("Aladhan response missing timings/date fields");
  }
  return { maghrib, weekdayEn, dateEn: dateEnOut, timezone };
}
