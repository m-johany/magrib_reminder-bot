import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { AladhanError, CityNotFoundError, fetchPrayerTimes } from "../src/aladhan";

const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

const aladhanResponse = {
  code: 200,
  status: "OK",
  data: {
    timings: { Maghrib: "19:45" },
    date: {
      gregorian: { date: "14-08-2026", weekday: { en: "Thursday" } },
    },
    meta: { timezone: "Europe/London" },
  },
};

const aladhanOk = () =>
  http.get("https://api.aladhan.com/v1/timingsByCity", () =>
    HttpResponse.json(aladhanResponse)
  );

describe("fetchPrayerTimes", () => {
  it("parses Maghrib, weekday and date from Aladhan response", async () => {
    server.use(aladhanOk());

    const result = await fetchPrayerTimes("London", "UK");
    expect(result).toEqual({
      maghrib: "19:45",
      weekdayEn: "Thursday",
      dateEn: "14-08-2026",
      timezone: "Europe/London",
    });
  });

  it("throws CityNotFoundError when Aladhan reports no such city", async () => {
    server.use(
      http.get("https://api.aladhan.com/v1/timingsByCity", () =>
        HttpResponse.json({ code: 200, status: "ERROR", data: "Unable to compute prayer times" })
      )
    );

    await expect(fetchPrayerTimes("Narnia", "XX")).rejects.toBeInstanceOf(CityNotFoundError);
  });

  it("throws AladhanError on non-200 responses", async () => {
    server.use(
      http.get("https://api.aladhan.com/v1/timingsByCity", () =>
        HttpResponse.json({ error: "boom" }, { status: 500 })
      )
    );

    await expect(fetchPrayerTimes("London", "UK")).rejects.toBeInstanceOf(AladhanError);
  });

  it("throws CityNotFoundError on Aladhan 400 validation errors", async () => {
    server.use(
      http.get("https://api.aladhan.com/v1/timingsByCity", () =>
        HttpResponse.json({ code: 400, status: "BAD_REQUEST", data: "Invalid city" }, { status: 400 })
      )
    );

    await expect(fetchPrayerTimes("Narnia", "XX")).rejects.toBeInstanceOf(CityNotFoundError);
  });
});
