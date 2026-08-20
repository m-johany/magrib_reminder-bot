export interface GeocodedCity {
  city: string;
  country: string;
}

export class GeocodeError extends Error {}

interface OpenMeteoResponse {
  results?: { name?: string; country?: string }[];
}

/**
 * Resolve a bare city name to its canonical city + country using the
 * Open-Meteo geocoding API (free, no key, global GeoNames coverage).
 * Returns null when the name matches nothing; throws GeocodeError on
 * API/network failures so callers can tell "not found" from "unavailable".
 */
export async function resolveCityName(city: string): Promise<GeocodedCity | null> {
  const url = new URL("https://geocoding-api.open-meteo.com/v1/search");
  url.searchParams.set("name", city);
  url.searchParams.set("count", "1");
  url.searchParams.set("language", "en");
  url.searchParams.set("format", "json");

  let body: OpenMeteoResponse;
  try {
    const res = await fetch(url);
    if (!res.ok) {
      throw new GeocodeError(`Open-Meteo HTTP ${res.status}`);
    }
    body = (await res.json()) as OpenMeteoResponse;
  } catch (err) {
    if (err instanceof GeocodeError) throw err;
    throw new GeocodeError("Open-Meteo returned non-JSON or failed to fetch");
  }

  const top = body.results?.[0];
  if (!top?.name || !top?.country) {
    return null;
  }
  return { city: top.name, country: top.country };
}
