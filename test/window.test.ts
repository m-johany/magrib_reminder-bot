import { describe, expect, it } from "vitest";
import { formatDateEn, formatHHMM, minutesSinceMaghrib, previousDateEn } from "../src/window";

describe("minutesSinceMaghrib", () => {
  it("is 0 exactly at Maghrib", () => {
    expect(minutesSinceMaghrib("20:00", "20:00")).toBe(0);
  });

  it("counts minutes after Maghrib", () => {
    expect(minutesSinceMaghrib("20:00", "20:05")).toBe(5);
  });

  it("handles midnight rollover as a continuation of the same evening", () => {
    // Maghrib 23:55, now 00:05 → 10 minutes after.
    expect(minutesSinceMaghrib("23:55", "00:05")).toBe(10);
  });

  it("is large when Maghrib has not yet passed", () => {
    expect(minutesSinceMaghrib("20:00", "19:00")).toBe(23 * 60);
  });

  it("is large for the wrong day entirely (maghrib long passed)", () => {
    expect(minutesSinceMaghrib("18:00", "20:05")).toBe(125);
  });
});

describe("formatHHMM", () => {
  it("formats an instant in the given timezone", () => {
    // 19:05 UTC = 20:05 in London (BST) during August.
    expect(formatHHMM(new Date("2026-08-14T19:05:00Z"), "Europe/London")).toBe("20:05");
  });
});

describe("formatDateEn / previousDateEn", () => {
  it("formats date as DD-MM-YYYY in the given timezone", () => {
    expect(formatDateEn(new Date("2026-08-14T19:05:00Z"), "Europe/London")).toBe("14-08-2026");
  });

  it("returns the previous day", () => {
    expect(previousDateEn(new Date("2026-08-15T00:05:00Z"), "Europe/London")).toBe("14-08-2026");
  });
});
