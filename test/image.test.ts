import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { buildCardSvg } from "../src/card";
import { renderCardPng } from "../src/image";
import type { HadithText } from "../src/messages";

const hadith: HadithText = {
  textEn: "Whoever recites Surah al-Kahf on Friday, a light will shine for him between the two Fridays.",
  textAr: "مَنْ قَرَأَ سُورَةَ الْكَهْفِ يَوْمَ الْجُمُعَةِ أَضَاءَ لَهُ مِنَ النُّورِ مَا بَيْنَ الْجُمُعَتَيْنِ",
  sourceEn: "Al-Mustadrak 2/399; graded sahih by al-Albani, Sahih al-Jami' 6470",
  sourceAr: "المستدرك ٢/٣٩٩، وصححه الألباني في صحيح الجامع ٦٤٧٠",
};

const wasmPath = join(
  process.cwd(),
  "node_modules",
  "@resvg",
  "resvg-wasm",
  "index_bg.wasm"
);

describe("renderCardPng", () => {
  it("renders the card SVG to a valid PNG", async () => {
    const png = await renderCardPng(buildCardSvg(hadith, "en"), () =>
      readFile(wasmPath)
    );

    // PNG magic bytes
    expect(png[0]).toBe(0x89);
    expect(png[1]).toBe(0x50);
    expect(png[2]).toBe(0x4e);
    expect(png[3]).toBe(0x47);
    expect(png.length).toBeGreaterThan(10_000);
  });
});
