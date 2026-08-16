import { describe, expect, it } from "vitest";
import { CityNotFoundError, type PrayerTimes } from "../src/aladhan";
import { setCityCommand, statusCommand, type UserStore } from "../src/commands";

function fakeStore(initial: Record<string, { city: string; country: string }>): UserStore {
  const users = new Map(Object.entries(initial));
  return {
    async upsert(chatId, fields) {
      users.set(chatId, fields);
    },
    async get(chatId) {
      const u = users.get(chatId);
      return u
        ? { telegram_chat_id: chatId, city: u.city, country: u.country, language: "en", paused: false }
        : null;
    },
  };
}

const okTimings: PrayerTimes = {
  maghrib: "19:45",
  weekdayEn: "Thursday",
  dateEn: "14-08-2026",
};

describe("setCityCommand", () => {
  it("stores a valid city and confirms", async () => {
    const store = fakeStore({});
    const reply = await setCityCommand("London, UK", "42", {
      store,
      fetchPrayerTimes: async () => okTimings,
    });
    expect(reply).toBe("Your city is set to London, UK");
    expect(await store.get("42")).toMatchObject({ city: "London", country: "UK" });
  });

  it("asks for the right format when city is invalid", async () => {
    const reply = await setCityCommand("Narnia, XX", "42", {
      store: fakeStore({}),
      fetchPrayerTimes: async () => {
        throw new CityNotFoundError();
      },
    });
    expect(reply).toBe(
      "I couldn't find that city. Please try again with format: /setcity London, UK"
    );
  });

  it("rejects input without a comma", async () => {
    let called = false;
    const reply = await setCityCommand("London", "42", {
      store: fakeStore({}),
      fetchPrayerTimes: async () => {
        called = true;
        return okTimings;
      },
    });
    expect(reply).toContain("/setcity London, UK");
    expect(called).toBe(false);
  });
});

describe("statusCommand", () => {
  it("shows current city and country", async () => {
    const reply = await statusCommand("42", {
      store: fakeStore({ "42": { city: "London", country: "UK" } }),
    });
    expect(reply).toContain("London");
    expect(reply).toContain("UK");
  });

  it("guides user to /setcity when no city set", async () => {
    const reply = await statusCommand("42", { store: fakeStore({}) });
    expect(reply).toBe("No city set. Use /setcity to configure");
  });
});
