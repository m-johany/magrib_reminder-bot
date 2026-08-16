import { describe, expect, it } from "vitest";
import type { PrayerTimes } from "../src/aladhan";
import { runTick, type ActiveUser, type Hadith, type TickDeps } from "../src/cron";

interface FetchedTimings {
  city: string;
  dateEn: string | null;
  timings: PrayerTimes;
}

const weekHadith: Hadith = {
  id: 3,
  textEn: "Whoever recites Surah al-Kahf on Friday, a light will shine for him between the two Fridays.",
  textAr: "مَنْ قَرَأَ سُورَةَ الْكَهْفِ يَوْمَ الْجُمُعَةِ أَضَاءَ لَهُ مِنَ النُّورِ مَا بَيْنَ الْجُمُعَتَيْنِ",
  sourceEn: "Al-Mustadrak 2/399; graded sahih by al-Albani",
  sourceAr: "المستدرك ٢/٣٩٩ وصححه الألباني",
};

function makeDeps(
  users: ActiveUser[],
  fetchResults: FetchedTimings[],
  hadiths: Hadith[] = [weekHadith]
) {
  const fetchCalls: { city: string; dateEn: string | null }[] = [];
  const sends: { chatId: string; text: string; photo?: Uint8Array }[] = [];
  const records: { userId: number; hadithId: number | null; weekKey: string }[] = [];
  const errors: string[] = [];
  const hadithOrders: number[] = [];
  const imageBuilds: string[] = [];

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
    async sendReminder(chatId, text, photo) {
      sends.push({ chatId, text, photo });
    },
    async createImage(_hadith, lang) {
      imageBuilds.push(lang);
      return new Uint8Array([0x89, 0x50, 0x4e, 0x47]);
    },
    async alreadySent() {
      return false;
    },
    async recordSend(userId, hadithId, weekKey) {
      records.push({ userId, hadithId, weekKey });
    },
    async countHadith() {
      return hadiths.length;
    },
    async getHadithByWeekOrder(weekOrder) {
      hadithOrders.push(weekOrder);
      return hadiths[weekOrder % hadiths.length] ?? null;
    },
    async sleep(_ms) {
      // tests that care about the delay override this
    },
    logError(msg) {
      errors.push(msg);
    },
    logWarn(_msg) {
      // warnings (e.g. Aladhan retry notices) are not errors
    },
  };

  return { deps, fetchCalls, sends, records, errors, hadithOrders, imageBuilds };
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
      records.push({ userId: 1, hadithId: null, weekKey: "2026-W33" });
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

  it("includes the week's hadith in the reminder and records its id", async () => {
    // 2026-08-13 is ISO week 33; weekOrder = 33 % 1 = 0.
    const { deps, sends, records, hadithOrders } = makeDeps([londonActive], [
      { city: "London", dateEn: null, timings: thursdayLondon },
    ]);

    await runTick(new Date("2026-08-13T19:05:00Z"), deps);

    expect(hadithOrders).toEqual([33 % 1]);
    expect(sends[0]?.text).toContain("light will shine");
    expect(records[0]).toMatchObject({ userId: 1, hadithId: 3 });
  });

  it("picks the same hadith for every user in the same week (single lookup per tick)", async () => {
    const { deps, hadithOrders } = makeDeps([londonActive, londonActive2], [
      { city: "London", dateEn: null, timings: thursdayLondon },
    ]);

    await runTick(new Date("2026-08-13T19:05:00Z"), deps);

    expect(hadithOrders).toHaveLength(1);
  });

  it("falls back to a plain reminder when no hadith are seeded", async () => {
    const { deps, sends, records } = makeDeps([londonActive], [
      { city: "London", dateEn: null, timings: thursdayLondon },
    ], []);

    await runTick(new Date("2026-08-13T19:05:00Z"), deps);

    expect(sends[0]?.text).not.toContain("Hadith");
    expect(sends[0]?.photo).toBeUndefined();
    expect(records[0]?.hadithId).toBeNull();
  });

  it("sends the hadith card image as a photo with the warm message as caption", async () => {
    const { deps, sends } = makeDeps([londonActive], [
      { city: "London", dateEn: null, timings: thursdayLondon },
    ]);

    await runTick(new Date("2026-08-13T19:05:00Z"), deps);

    expect(sends[0]?.photo).toBeInstanceOf(Uint8Array);
    expect(sends[0]?.text).toContain("Surah al-Kahf");
  });

  it("renders each language variant of the image at most once per tick", async () => {
    const arUser: ActiveUser = { ...londonActive2, id: 9, telegram_chat_id: "999", language: "ar" };
    const { deps, imageBuilds } = makeDeps([londonActive, londonActive2, arUser], [
      { city: "London", dateEn: null, timings: thursdayLondon },
    ]);

    await runTick(new Date("2026-08-13T19:05:00Z"), deps);

    expect(imageBuilds.filter((l) => l === "en")).toHaveLength(1);
    expect(imageBuilds.filter((l) => l === "ar")).toHaveLength(1);
  });

  it("falls back to text-only when image generation fails", async () => {
    const { deps, sends, errors } = makeDeps([londonActive], [
      { city: "London", dateEn: null, timings: thursdayLondon },
    ]);
    deps.createImage = async () => {
      throw new Error("wasm boom");
    };

    await runTick(new Date("2026-08-13T19:05:00Z"), deps);

    expect(sends[0]?.photo).toBeUndefined();
    expect(sends[0]?.text).toContain("light will shine");
    expect(errors).toHaveLength(1);
  });

  it("retries a failed Aladhan fetch once after a delay", async () => {
    const { deps, sends, fetchCalls, errors } = makeDeps([londonActive], [
      { city: "London", dateEn: null, timings: thursdayLondon },
    ]);
    const sleeps: number[] = [];
    deps.sleep = async (ms) => {
      sleeps.push(ms);
    };
    let attempts = 0;
    deps.fetchTimings = async (city, _country, dateEn) => {
      fetchCalls.push({ city, dateEn });
      attempts += 1;
      if (attempts === 1) throw new Error("Aladhan 500");
      return thursdayLondon;
    };

    await runTick(new Date("2026-08-13T19:05:00Z"), deps);

    expect(fetchCalls.filter((c) => c.city === "London")).toHaveLength(2);
    expect(sleeps).toEqual([30_000]);
    expect(sends.map((s) => s.chatId)).toEqual(["111"]);
    expect(errors).toHaveLength(0);
  });

  it("skips the city after the retry also fails, logging the error", async () => {
    const { deps, sends, errors } = makeDeps([londonActive], [
      { city: "London", dateEn: null, timings: thursdayLondon },
    ]);
    const sleeps: number[] = [];
    deps.sleep = async (ms) => {
      sleeps.push(ms);
    };
    deps.fetchTimings = async () => {
      throw new Error("Aladhan down");
    };

    await runTick(new Date("2026-08-13T19:05:00Z"), deps);

    expect(sleeps).toEqual([30_000]);
    expect(sends).toHaveLength(0);
    expect(errors).toHaveLength(1);
  });

  it("logs chat_id context on per-user send failures", async () => {
    const { deps } = makeDeps([londonActive], [
      { city: "London", dateEn: null, timings: thursdayLondon },
    ]);
    const logged: (string | undefined)[] = [];
    deps.sendReminder = async () => {
      throw new Error("telegram down");
    };
    deps.logError = (_msg, _err, ctx) => {
      logged.push(ctx?.chat_id);
    };

    await runTick(new Date("2026-08-13T19:05:00Z"), deps);

    expect(logged).toEqual(["111"]);
  });
});
