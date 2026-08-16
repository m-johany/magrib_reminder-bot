import { describe, expect, it } from "vitest";
import { parseWeekNumber, pickHadithIndex } from "../src/rotation";

describe("parseWeekNumber", () => {
  it("extracts the week number from an ISO week key", () => {
    expect(parseWeekNumber("2026-W33")).toBe(33);
  });

  it("handles single-digit weeks without padding", () => {
    expect(parseWeekNumber("2026-W07")).toBe(7);
  });
});

describe("pickHadithIndex", () => {
  it("maps week number modulo hadith count", () => {
    expect(pickHadithIndex(33, 10)).toBe(3);
  });

  it("wraps around at the end of the cycle", () => {
    expect(pickHadithIndex(40, 10)).toBe(0);
    expect(pickHadithIndex(41, 10)).toBe(1);
  });

  it("works for any count", () => {
    expect(pickHadithIndex(7, 1)).toBe(0);
    expect(pickHadithIndex(7, 12)).toBe(7);
  });

  it("throws on empty hadith collection", () => {
    expect(() => pickHadithIndex(33, 0)).toThrow();
  });
});
