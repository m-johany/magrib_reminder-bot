import { CityNotFoundError, type PrayerTimes } from "./aladhan";
import type { Hadith } from "./cron";
import type { GeocodedCity } from "./geocode";
import {
  cityNotFoundText,
  citySetText,
  languageSetText,
  noCityText,
  pausedText,
  reminderText,
  resumedText,
  serviceUnavailableText,
  statusText,
  testImageFailedText,
  testPreviewText,
  type HadithText,
  type Language,
} from "./messages";
import { parseWeekNumber, pickHadithIndex } from "./rotation";
import { isoWeekKey } from "./week";

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

export async function isGroupAdmin(
  getMemberStatus: (chatId: string, userId: number) => Promise<string>,
  chatId: string,
  userId: number
): Promise<boolean> {
  try {
    const status = await getMemberStatus(chatId, userId);
    return status === "creator" || status === "administrator";
  } catch {
    return false;
  }
}

export interface CommandDeps {
  store: UserStore;
  fetchPrayerTimes: (city: string, country: string) => Promise<PrayerTimes>;
  resolveCity: (city: string) => Promise<GeocodedCity | null>;
}

export async function setCityCommand(
  raw: string,
  chatId: string,
  deps: CommandDeps
): Promise<string> {
  const user = await deps.store.get(chatId);
  const lang = user?.language ?? "en";

  const comma = raw.indexOf(",");
  let city: string;
  let country: string;
  if (comma === -1) {
    // Bare city name — resolve the country via geocoding.
    const name = raw.trim();
    if (!name) {
      return cityNotFoundText(lang);
    }
    let resolved: GeocodedCity | null;
    try {
      resolved = await deps.resolveCity(name);
    } catch {
      // Geocoding service down — ask the user to retry later.
      return serviceUnavailableText(lang);
    }
    if (!resolved) {
      return cityNotFoundText(lang);
    }
    city = resolved.city;
    country = resolved.country;
  } else {
    city = raw.slice(0, comma).trim();
    country = raw.slice(comma + 1).trim();
    if (!city || !country) {
      return cityNotFoundText(lang);
    }
  }

  try {
    await deps.fetchPrayerTimes(city, country);
  } catch (err) {
    if (err instanceof CityNotFoundError) {
      return cityNotFoundText(lang);
    }
    // Service unavailable — ask the user to retry later (hardened in #7).
    return serviceUnavailableText(lang);
  }

  await deps.store.save(chatId, { city, country });
  return citySetText(lang, city, country);
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

export interface TestDeps {
  store: UserStore;
  fetchPrayerTimes: (city: string, country: string) => Promise<PrayerTimes>;
  countHadith: () => Promise<number>;
  getHadithByWeekOrder: (weekOrder: number) => Promise<Hadith | null>;
  createImage: (hadith: HadithText, lang: Language) => Promise<Uint8Array>;
}

export interface TestResult {
  /** Reply text on error; photo caption on success. */
  text: string;
  /** Rendered card bytes when the image pipeline succeeded. */
  photo?: Uint8Array;
}

/**
 * Preview this week's reminder right now, mirroring the cron send path:
 * Aladhan city validation, the global weekly rotation, and card rendering
 * with a text-only fallback. Never writes sent_log, so the real Thursday
 * reminder still fires for this user.
 */
export async function testCommand(
  chatId: string,
  deps: TestDeps,
  now: Date = new Date()
): Promise<TestResult> {
  const user = await deps.store.get(chatId);
  const lang = user?.language ?? "en";

  if (!user?.city || !user.country) {
    return { text: noCityText(lang) };
  }

  try {
    await deps.fetchPrayerTimes(user.city, user.country);
  } catch (err) {
    if (err instanceof CityNotFoundError) {
      return { text: cityNotFoundText(lang) };
    }
    return { text: serviceUnavailableText(lang) };
  }

  // Same deterministic weekly rotation as the cron tick.
  const hadithCount = await deps.countHadith();
  const hadith =
    hadithCount > 0
      ? await deps.getHadithByWeekOrder(
          pickHadithIndex(parseWeekNumber(isoWeekKey(now)), hadithCount)
        )
      : null;

  const caption = [testPreviewText(lang), "", reminderText(lang, user.city, hadith)].join("\n");
  if (!hadith) {
    return { text: caption };
  }

  try {
    const photo = await deps.createImage(hadith, lang);
    return { text: caption, photo };
  } catch {
    // Same policy as the cron tick: a failed render never blocks the send.
    return {
      text: [
        testPreviewText(lang),
        testImageFailedText(lang),
        "",
        reminderText(lang, user.city, hadith),
      ].join("\n"),
    };
  }
}
