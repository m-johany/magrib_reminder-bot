import { CityNotFoundError, type PrayerTimes } from "./aladhan";
import { cityNotFoundText, citySetText, noCityText, statusText } from "./messages";

export interface User {
  telegram_chat_id: string;
  city: string;
  country: string;
  language: "en" | "ar";
  paused: boolean;
}

export interface UserStore {
  upsert(chatId: string, fields: { city: string; country: string }): Promise<void>;
  get(chatId: string): Promise<User | null>;
}

export interface CommandDeps {
  store: UserStore;
  fetchPrayerTimes: (city: string, country: string) => Promise<PrayerTimes>;
}

export async function setCityCommand(
  raw: string,
  chatId: string,
  deps: CommandDeps
): Promise<string> {
  const comma = raw.indexOf(",");
  if (comma === -1) {
    return cityNotFoundText("en");
  }
  const city = raw.slice(0, comma).trim();
  const country = raw.slice(comma + 1).trim();
  if (!city || !country) {
    return cityNotFoundText("en");
  }

  try {
    await deps.fetchPrayerTimes(city, country);
  } catch (err) {
    if (err instanceof CityNotFoundError) {
      return cityNotFoundText("en");
    }
    // Service unavailable — ask the user to retry later (hardened in #7).
    return "I couldn't reach the prayer times service. Please try again in a moment.";
  }

  await deps.store.upsert(chatId, { city, country });
  return citySetText("en", city, country);
}

export async function statusCommand(
  chatId: string,
  deps: Pick<CommandDeps, "store">
): Promise<string> {
  const user = await deps.store.get(chatId);
  if (!user) {
    return noCityText("en");
  }
  return statusText(user.language, {
    city: user.city,
    country: user.country,
    language: user.language,
    paused: user.paused,
  });
}
