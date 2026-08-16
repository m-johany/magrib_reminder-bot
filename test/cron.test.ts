import { describe, expect, it } from "vitest";
import type { PrayerTimes } from "../src/aladhan";
import { runTick, type ActiveUser, type TickDeps } from "../src/cron";

interface FetchedTimings {
  city: string;
  dateEn: string | null;
  timings: PrayerTimes;
}

function makeDeps(users: ActiveUser[], fetchResults: FetchedTimings[]) {
  const fetchCalls: { city: string; dateEn: string | null }[] = [];
  const sends: { chatId: string; text: string }[] = [];
  const records: { userId: number; weekKey: string }[] = [];
  const errors: string[] = [];

  const deps: TickDeps = {
    async listActiveUsers() {
      return users;
    },
    async fetchTimings(city, _country, dateEn) {
      fetchCalls.push({ city, dateEn });
      const hit = fetchResults.find(
        (r) => r.city === city && (r.dateEn ?? null) === dateEn
      );
      if (!hit) throw new Error(`no fixture for ${city} date=${dateEn}`);
      return hit.timings;
    },
    async sendReminder(chatId, text) {
      sends.push({ chatId, text });
    },
    async alreadySent() {
      return false;
    },
    async recordSend(userId, _hadithId, weekKey) {
      records.push({ userId, weekKey });
    },
    logError(msg) {
      errors.push(msg);
    },
  };

  return { deps, fetchCalls, sends, records, errors };
}

const londonActive: ActiveUser = {
  id: 1,
  telegram_chat_id: "111",
  city: "London",
  country: "UK",
  language: "en",
  paused: false,
};
const londonActive2: ActiveUser = {
  id: 2,
  telegram_chat_id: "222",
  city: "London",
  country: "UK",
  language: "en",
  paused: false,
};
const cairoActive: ActiveUser = {
  id: 3,
  telegram_chat_id: "333",
  city: "Cairo",
  country: "EG",
  language: "en",
  paused: false,
};
const londonPaused: ActiveUser = { ...londonActive, id: 4, telegram_chat_id: "444", paused: true };

const thursdayLondon: PrayerTimes = {
  maghrib: "20:00",
  weekdayEn: "Thursday",
  dateEn: "13-08-2026",
  timezone: "Europe/London",
};
const thursdayCairo: PrayerTimes = {
  maghrib: "19:30",
  weekdayEn: "Thursday",
  dateEn: "13-08-2026",
  timezone: "Africa/Cairo",
};
const fridayLondon: PrayerTimes = {
  maghrib: "20:01",
  weekdayEn: "Friday",
  dateEn: "14-08-2026",
  timezone: "Europe/London",
};

describe("runTick", () => {
  it("deduplicates Aladhan calls: one per unique city per date", async () => {
    const { deps, fetchCalls } = makeDeps([londonActive, londonActive2, cairoActive], [
      { city: "London", dateEn: null, timings: thursdayLondon },
      { city: "Cairo", dateEn: null, timings: thursdayCairo },
    ]);

    await runTick(new Date("2026-08-13T19:05:00Z"), deps);

    expect(fetchCalls.filter((c) => c.city === "London")).toHaveLength(1);
    expect(fetchCalls.filter((c) => c.city === "Cairo")).toHaveLength(1);
  });

  it("sends reminders to users whose Maghrib passed within the window on Thursday", async () => {
    const { deps, sends, records } = makeDeps([londonActive, londonActive2, cairoActive], [
      { city: "London", dateEn: null, timings: thursdayLondon },
      { city: "Cairo", dateEn: null, timings: thursdayCairo },
    ]);

    // 19:05 UTC = 20:05 London BST (maghrib 20:00, 5 min passed). Cairo 22:05 EEST (maghrib 19:30 → 155 min passed).
    await runTick(new Date("2026-08-13T19:05:00Z"), deps);

    expect(sends.map((s) => s.chatId).sort()).toEqual(["111", "222"]);
    expect(sends[0]?.text).toContain("Surah al-Kahf");
    expect(records).toHaveLength(2);
  });

  it("skips paused users", async () => {
    const { deps, sends } = makeDeps([londonActive, londonPaused], [
      { city: "London", dateEn: null, timings: thursdayLondon },
    ]);

    await runTick(new Date("2026-08-13T19:05:00Z"), deps);

    expect(sends.map((s) => s.chatId)).toEqual(["111"]);
  });

  it("does not send when Maghrib has not passed yet", async () => {
    const { deps, sends } = makeDeps([londonActive], [
      { city: "London", dateEn: null, timings: thursdayLondon },
    ]);

    await runTick(new Date("2026-08-13T19:30:00Z"), deps);

    expect(sends).toHaveLength(0);
  });

  it("does not send on other days even if a Maghrib time matches the window", async () => {
    const { deps, sends } = makeDeps([londonActive], [
      { city: "London", dateEn: null, timings: fridayLondon },
    ]);

    // Friday 20:10 local — 9 min after Friday's Maghrib, but not Thursday.
    await runTick(new Date("2026-08-14T19:10:00Z"), deps);

    expect(sends).toHaveLength(0);
  });

  it("sends just after midnight for a late Thursday Maghrib, checking yesterday's timings", async () => {
    const lateMaghrib: PrayerTimes = {
      maghrib: "23:55",
      weekdayEn: "Thursday",
      dateEn: "13-08-2026",
      timezone: "Europe/London",
    };
    const { deps, sends, fetchCalls } = makeDeps([londonActive], [
      { city: "London", dateEn: null, timings: fridayLondon },
      { city: "London", dateEn: "13-08-2026", timings: lateMaghrib },
    ]);

    // Friday 00:05 local (23:05 UTC) — Thursday's Maghrib was 10 minutes ago.
    await runTick(new Date("2026-08-13T23:05:00Z"), deps);

    expect(fetchCalls).toContainEqual({ city: "London", dateEn: "13-08-2026" });
    expect(sends.map((s) => s.chatId)).toEqual(["111"]);
  });

  it("does not resend within the same ISO week (sent_log dedup)", async () => {
    const { deps, sends, records } = makeDeps([londonActive], [
      { city: "London", dateEn: null, timings: thursdayLondon },
    ]);
    let sent = false;
    deps.alreadySent = async () => sent;
    deps.recordSend = async () => {
      sent = true;
      records.push({ userId: 1, weekKey: "2026-W33" });
    };

    await runTick(new Date("2026-08-13T19:05:00Z"), deps);
    await runTick(new Date("2026-08-13T19:06:00Z"), deps);

    expect(sends).toHaveLength(1);
  });

  it("isolates per-user send failures", async () => {
    const { deps, sends, errors } = makeDeps([londonActive, londonActive2], [
      { city: "London", dateEn: null, timings: thursdayLondon },
    ]);
    deps.sendReminder = async (chatId, text) => {
      if (chatId === "111") throw new Error("telegram down for this user");
      sends.push({ chatId, text });
    };

    await expect(runTick(new Date("2026-08-13T19:05:00Z"), deps)).resolves.toBeUndefined();

    expect(sends.map((s) => s.chatId)).toEqual(["222"]);
    expect(errors).toHaveLength(1);
  });
});
