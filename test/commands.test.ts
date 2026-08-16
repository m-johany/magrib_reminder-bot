import { describe, expect, it } from "vitest";
import { CityNotFoundError, type PrayerTimes } from "../src/aladhan";
import {
  pauseCommand,
  resumeCommand,
  setCityCommand,
  setLanguageCommand,
  statusCommand,
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
