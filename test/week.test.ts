import { describe, expect, it } from "vitest";
import { isoWeekKey } from "../src/week";

describe("isoWeekKey", () => {
  it("returns ISO year and week for a known date", () => {
    // 2026-08-14 is a Friday in ISO week 33.
    expect(isoWeekKey(new Date("2026-08-14T12:00:00Z"))).toBe("2026-W33");
  });

  it("treats Monday as the first day of the week", () => {
    // Sunday 2026-08-16 belongs to week 33, Monday 2026-08-17 to week 34.
    expect(isoWeekKey(new Date("2026-08-16T00:00:00Z"))).toBe("2026-W33");
    expect(isoWeekKey(new Date("2026-08-17T00:00:00Z"))).toBe("2026-W34");
  });

  it("handles the year boundary (Jan 1 belongs to the last week of the previous year)", () => {
    // 2021-01-01 is a Friday, ISO week 53 of 2020.
    expect(isoWeekKey(new Date("2021-01-01T00:00:00Z"))).toBe("2020-W53");
  });
});
