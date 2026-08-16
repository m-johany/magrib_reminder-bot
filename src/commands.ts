import { CityNotFoundError, type PrayerTimes } from "./aladhan";
import {
  cityNotFoundText,
  citySetText,
  languageSetText,
  noCityText,
  pausedText,
  resumedText,
  statusText,
  type Language,
} from "./messages";

export interface User {
  telegram_chat_id: string;
  city: string | null;
  country: string | null;
  language: Language;
  paused: boolean;
}

export type UserPatch = Partial<Omit<User, "telegram_chat_id">>;

export interface UserStore {
  save(chatId: string, fields: UserPatch): Promise<void>;
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

  await deps.store.save(chatId, { city, country });
  const user = await deps.store.get(chatId);
  return citySetText(user?.language ?? "en", city, country);
}

export async function statusCommand(
  chatId: string,
  deps: Pick<CommandDeps, "store">
): Promise<string> {
  const user = await deps.store.get(chatId);
  if (!user || !user.city || !user.country) {
    return noCityText(user?.language ?? "en");
  }
  return statusText(user.language, {
    city: user.city,
    country: user.country,
    language: user.language,
    paused: user.paused,
  });
}

export async function setLanguageCommand(
  lang: Language,
  chatId: string,
  deps: Pick<CommandDeps, "store">
): Promise<string> {
  await deps.store.save(chatId, { language: lang });
  return languageSetText(lang);
}

export async function pauseCommand(
  chatId: string,
  deps: Pick<CommandDeps, "store">
): Promise<string> {
  await deps.store.save(chatId, { paused: true });
  const user = await deps.store.get(chatId);
  return pausedText(user?.language ?? "en");
}

export async function resumeCommand(
  chatId: string,
  deps: Pick<CommandDeps, "store">
): Promise<string> {
  await deps.store.save(chatId, { paused: false });
  const user = await deps.store.get(chatId);
  return resumedText(user?.language ?? "en");
}
