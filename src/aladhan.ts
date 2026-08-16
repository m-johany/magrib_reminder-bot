export interface PrayerTimes {
  maghrib: string; // "HH:MM" 24-hour, e.g. "19:45"
  weekdayEn: string; // e.g. "Thursday"
  dateEn: string; // "DD-MM-YYYY" gregorian
}

export class AladhanError extends Error {}
export class CityNotFoundError extends Error {}

interface AladhanResponse {
  code: number;
  status: string;
  data?: {
    timings?: { Maghrib?: string };
    date?: { gregorian?: { date?: string; weekday?: { en?: string } } };
  };
}

export async function fetchPrayerTimes(
  city: string,
  country: string,
  fetchFn: typeof fetch = fetch
): Promise<PrayerTimes> {
  const url = new URL("https://api.aladhan.com/v1/timingsByCity");
  url.searchParams.set("city", city);
  url.searchParams.set("country", country);
  url.searchParams.set("method", "2"); // ISNA

  const res = await fetchFn(url);
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
    throw new CityNotFoundError();
  }

  const { timings, date } = body.data;
  const maghrib = timings?.Maghrib;
  const weekdayEn = date?.gregorian?.weekday?.en;
  const dateEn = date?.gregorian?.date;
  if (!maghrib || !weekdayEn || !dateEn) {
    throw new AladhanError("Aladhan response missing timings/date fields");
  }
  return { maghrib, weekdayEn, dateEn };
}
