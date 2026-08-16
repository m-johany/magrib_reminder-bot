/** Extract the integer week number from an ISO week key like "2026-W33". */
export function parseWeekNumber(weekKey: string): number {
  const n = Number.parseInt(weekKey.split("-W")[1] ?? "", 10);
  if (Number.isNaN(n)) {
    throw new Error(`Invalid ISO week key: ${weekKey}`);
  }
  return n;
}

/**
 * Deterministic weekly rotation: the active hadith is
 * `week_number % hadith_count`, cycling through all entries.
 */
export function pickHadithIndex(weekNumber: number, hadithCount: number): number {
  if (hadithCount <= 0) {
    throw new Error("Hadith count must be positive");
  }
  return weekNumber % hadithCount;
}
