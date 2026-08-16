import type { PrayerTimes } from "./aladhan";
import { reminderText, type HadithText, type Language } from "./messages";
import { parseWeekNumber, pickHadithIndex } from "./rotation";
import { isoWeekKey } from "./week";
import {
  formatHHMM,
  minutesSinceMaghrib,
  previousDateEn,
  previousWeekdayEn,
} from "./window";

/** How long after Maghrib a tick may still fire the reminder (10-min cadence + jitter margin). */
export const REMINDER_WINDOW_MIN = 15;

/** How long after midnight we still check the previous day's Maghrib (late Maghribs). */
const EARLY_MORNING_CUTOFF = "00:30";

export interface ActiveUser {
  id: number;
  telegram_chat_id: string;
  city: string;
  country: string;
  language: Language;
  paused: boolean;
}

export interface Hadith extends HadithText {
  id: number;
}

export interface TickDeps {
  listActiveUsers(): Promise<ActiveUser[]>;
  fetchTimings(city: string, country: string, dateEn: string | null): Promise<PrayerTimes>;
  sendReminder(chatId: string, text: string): Promise<void>;
  alreadySent(userId: number, weekKey: string): Promise<boolean>;
  recordSend(userId: number, hadithId: number | null, weekKey: string): Promise<void>;
  countHadith(): Promise<number>;
  getHadithByWeekOrder(weekOrder: number): Promise<Hadith | null>;
  logError(message: string, err?: unknown): void;
}

export async function runTick(now: Date, deps: TickDeps): Promise<void> {
  const users = (await deps.listActiveUsers()).filter((u) => !u.paused && u.city && u.country);
  const weekKey = isoWeekKey(now);

  // Global weekly rotation: every user gets the same hadith each week.
  const hadithCount = await deps.countHadith();
  const hadith =
    hadithCount > 0
      ? await deps.getHadithByWeekOrder(pickHadithIndex(parseWeekNumber(weekKey), hadithCount))
      : null;

  // Group users by unique city so each city hits the Aladhan API once per date.
  const cities = new Map<string, ActiveUser[]>();
  for (const u of users) {
    const key = `${u.city}|${u.country}`;
    const list = cities.get(key) ?? [];
    list.push(u);
    cities.set(key, list);
  }

  const timingsCache = new Map<string, Promise<PrayerTimes>>();
  const fetchTimings = (city: string, country: string, dateEn: string | null) => {
    const key = `${city}|${country}|${dateEn ?? "today"}`;
    let p = timingsCache.get(key);
    if (!p) {
      p = deps.fetchTimings(city, country, dateEn);
      timingsCache.set(key, p);
    }
    return p;
  };

  const due: ActiveUser[] = [];

  for (const [cityKey, cityUsers] of cities) {
    try {
      const [city, country] = cityKey.split("|") as [string, string];
      const today = await fetchTimings(city, country, null);
      const nowHHMM = formatHHMM(now, today.timezone);

      let passed = false;
      if (today.weekdayEn === "Thursday") {
        passed = minutesSinceMaghrib(today.maghrib, nowHHMM) <= REMINDER_WINDOW_MIN;
      } else if (nowHHMM < EARLY_MORNING_CUTOFF && previousWeekdayEn(now, today.timezone) === "Thursday") {
        // Thursday's Maghrib may still be inside the window just after midnight.
        const yesterday = await fetchTimings(city, country, previousDateEn(now, today.timezone));
        passed = minutesSinceMaghrib(yesterday.maghrib, nowHHMM) <= REMINDER_WINDOW_MIN;
      }
      if (passed) {
        due.push(...cityUsers);
      }
    } catch (err) {
      deps.logError(`Aladhan fetch failed for ${cityKey}`, err);
    }
  }

  for (const user of due) {
    try {
      if (await deps.alreadySent(user.id, weekKey)) {
        continue;
      }
      await deps.sendReminder(
        user.telegram_chat_id,
        reminderText(user.language, user.city as string, hadith)
      );
      await deps.recordSend(user.id, hadith?.id ?? null, weekKey);
    } catch (err) {
      deps.logError(`Reminder send failed for user ${user.id}`, err);
    }
  }
}
