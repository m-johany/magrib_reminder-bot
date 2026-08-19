import { describe, expect, it } from "vitest";
import { CityNotFoundError, type PrayerTimes } from "../src/aladhan";
import {
  pauseCommand,
  resumeCommand,
  setCityCommand,
  setLanguageCommand,
  statusCommand,
  testCommand,
  type TestDeps,
  type User,
  type UserStore,
} from "../src/commands";

function fakeStore(initial: Record<string, User> = {}): UserStore {
  const users = new Map(Object.entries(initial));
  return {
    async save(chatId, fields) {
      const existing = users.get(chatId) ?? {
        telegram_chat_id: chatId,
        city: null,
        country: null,
        language: "en",
        paused: false,
      };
      users.set(chatId, { ...existing, ...fields });
    },
    async get(chatId) {
      return users.get(chatId) ?? null;
    },
  };
}

const okTimings: PrayerTimes = {
  maghrib: "19:45",
  weekdayEn: "Thursday",
  dateEn: "14-08-2026",
  timezone: "Europe/London",
};

describe("setCityCommand", () => {
  it("stores a valid city and confirms", async () => {
    const store = fakeStore();
    const reply = await setCityCommand("London, UK", "42", {
      store,
      fetchPrayerTimes: async () => okTimings,
    });
    expect(reply).toBe("Your city is set to London, UK");
    expect(await store.get("42")).toMatchObject({ city: "London", country: "UK" });
  });

  it("asks for the right format when city is invalid", async () => {
    const reply = await setCityCommand("Narnia, XX", "42", {
      store: fakeStore(),
      fetchPrayerTimes: async () => {
        throw new CityNotFoundError();
      },
    });
    expect(reply).toBe(
      "I couldn't find that city. Please try again with format: /setcity London, UK"
    );
  });

  it("answers Arabic-language users in Arabic on invalid city", async () => {
    const store = fakeStore();
    await store.save("42", { language: "ar" });
    const reply = await setCityCommand("Narnia, XX", "42", {
      store,
      fetchPrayerTimes: async () => {
        throw new CityNotFoundError();
      },
    });
    expect(reply).toContain("لم أجد");
  });

  it("rejects input without a comma", async () => {
    let called = false;
    const reply = await setCityCommand("London", "42", {
      store: fakeStore(),
      fetchPrayerTimes: async () => {
        called = true;
        return okTimings;
      },
    });
    expect(reply).toContain("/setcity London, UK");
    expect(called).toBe(false);
  });

  it("confirms in the user's language", async () => {
    const store = fakeStore();
    await store.save("42", { language: "ar" });
    const reply = await setCityCommand("London, UK", "42", {
      store,
      fetchPrayerTimes: async () => okTimings,
    });
    expect(reply).toContain("تم حفظ مدينتك");
  });
});

describe("statusCommand", () => {
  it("shows current city and country", async () => {
    const reply = await statusCommand("42", {
      store: fakeStore({
        "42": { telegram_chat_id: "42", city: "London", country: "UK", language: "en", paused: false },
      }),
    });
    expect(reply).toContain("London, UK");
  });

  it("shows language and paused state", async () => {
    const reply = await statusCommand("42", {
      store: fakeStore({
        "42": { telegram_chat_id: "42", city: "London", country: "UK", language: "en", paused: true },
      }),
    });
    expect(reply).toContain("English");
    expect(reply).toContain("Paused");
  });

  it("renders status in Arabic for Arabic-language users", async () => {
    const reply = await statusCommand("42", {
      store: fakeStore({
        "42": { telegram_chat_id: "42", city: "London", country: "UK", language: "ar", paused: true },
      }),
    });
    expect(reply).toContain("متوقفة");
  });

  it("guides user to /setcity when no city set", async () => {
    const reply = await statusCommand("42", { store: fakeStore() });
    expect(reply).toBe("No city set. Use /setcity to configure");
  });
});

describe("setLanguageCommand", () => {
  it("stores the language and confirms", async () => {
    const store = fakeStore();
    const reply = await setLanguageCommand("ar", "42", { store });
    expect(await store.get("42")).toMatchObject({ language: "ar" });
    expect(reply).toContain("العربية");
  });
});

describe("pauseCommand / resumeCommand", () => {
  it("pause sets paused=true and confirms", async () => {
    const store = fakeStore({
      "42": { telegram_chat_id: "42", city: "London", country: "UK", language: "en", paused: false },
    });
    const reply = await pauseCommand("42", { store });
    expect((await store.get("42"))?.paused).toBe(true);
    expect(reply).toContain("/resume");
  });

  it("resume sets paused=false and confirms", async () => {
    const store = fakeStore({
      "42": { telegram_chat_id: "42", city: "London", country: "UK", language: "en", paused: true },
    });
    const reply = await resumeCommand("42", { store });
    expect((await store.get("42"))?.paused).toBe(false);
    expect(reply).toContain("resumed");
  });
});

describe("testCommand", () => {
  // Deterministic clock: 2026-08-19 is ISO week 33; 33 % 8 = 1.
  const now = new Date("2026-08-19T12:00:00Z");
  const hadith = {
    id: 4,
    textEn: "Test hadith English",
    textAr: "حديث تجريبي",
    sourceEn: "Test source",
    sourceAr: "مصدر تجريبي",
  };
  const happyDeps: TestDeps = {
    store: fakeStore({
      "42": { telegram_chat_id: "42", city: "London", country: "UK", language: "en", paused: false },
    }),
    fetchPrayerTimes: async () => okTimings,
    countHadith: async () => 8,
    getHadithByWeekOrder: async () => hadith,
    createImage: async () => new Uint8Array([137, 80, 78, 71]),
  };

  it("renders and returns this week's reminder card", async () => {
    const result = await testCommand("42", happyDeps, now);
    expect(result.photo).toBeDefined();
    expect(result.text).toContain("test preview");
    expect(result.text).toContain("London");
    expect(result.text).toContain("Test hadith English");
  });

  it("uses the same weekly rotation as the cron tick", async () => {
    const orders: number[] = [];
    const result = await testCommand(
      "42",
      {
        ...happyDeps,
        getHadithByWeekOrder: async (weekOrder) => {
          orders.push(weekOrder);
          return hadith;
        },
      },
      now
    );
    expect(orders[0]).toBe(2); // ISO week 34 % 8 hadith
    expect(result.photo).toBeDefined();
  });

  it("asks for a city before testing", async () => {
    let fetched = false;
    const result = await testCommand(
      "42",
      {
        ...happyDeps,
        store: fakeStore(),
        fetchPrayerTimes: async () => {
          fetched = true;
          return okTimings;
        },
      },
      now
    );
    expect(result.text).toBe("No city set. Use /setcity to configure");
    expect(result.photo).toBeUndefined();
    expect(fetched).toBe(false);
  });

  it("reports an unknown city", async () => {
    const result = await testCommand(
      "42",
      {
        ...happyDeps,
        fetchPrayerTimes: async () => {
          throw new CityNotFoundError();
        },
      },
      now
    );
    expect(result.text).toContain("couldn't find that city");
    expect(result.photo).toBeUndefined();
  });

  it("reports a prayer-times service outage", async () => {
    const result = await testCommand(
      "42",
      {
        ...happyDeps,
        fetchPrayerTimes: async () => {
          throw new Error("boom");
        },
      },
      now
    );
    expect(result.text).toContain("couldn't reach the prayer times service");
    expect(result.photo).toBeUndefined();
  });

  it("falls back to text when the card render fails", async () => {
    const result = await testCommand(
      "42",
      {
        ...happyDeps,
        createImage: async () => {
          throw new Error("resvg oom");
        },
      },
      now
    );
    expect(result.photo).toBeUndefined();
    expect(result.text).toContain("failed to render");
    expect(result.text).toContain("Test hadith English");
  });

  it("sends text-only when no hadith are seeded", async () => {
    const result = await testCommand("42", { ...happyDeps, countHadith: async () => 0 }, now);
    expect(result.photo).toBeUndefined();
    expect(result.text).toContain("test preview");
    expect(result.text).not.toContain("Test hadith English");
  });

  it("previews in Arabic for Arabic-language users, even when paused", async () => {
    const result = await testCommand(
      "42",
      {
        ...happyDeps,
        store: fakeStore({
          "42": { telegram_chat_id: "42", city: "القاهرة", country: "EG", language: "ar", paused: true },
        }),
      },
      now
    );
    expect(result.text).toContain("معاينة تجريبية");
    expect(result.photo).toBeDefined();
  });
});
