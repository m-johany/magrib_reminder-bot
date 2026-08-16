import { describe, expect, it } from "vitest";
import { buildCardSvg, escapeXml, wrapText } from "../src/card";
import type { HadithText } from "../src/messages";

const hadith: HadithText = {
  textEn: "Whoever recites Surah al-Kahf on Friday, a light will shine for him between the two Fridays.",
  textAr: "مَنْ قَرَأَ سُورَةَ الْكَهْفِ يَوْمَ الْجُمُعَةِ أَضَاءَ لَهُ مِنَ النُّورِ مَا بَيْنَ الْجُمُعَتَيْنِ",
  sourceEn: "Al-Mustadrak 2/399; graded sahih by al-Albani, Sahih al-Jami' 6470",
  sourceAr: "المستدرك ٢/٣٩٩، وصححه الألباني في صحيح الجامع ٦٤٧٠",
};

function normalizedSvg(lang: "en" | "ar"): string {
  // Line wrapping inserts newlines inside long phrases; normalize whitespace
  // so assertions target text, not layout.
  return buildCardSvg(hadith, lang).replace(/\s+/g, " ");
}

describe("buildCardSvg", () => {
  it("renders a 1080x1080 card", () => {
    expect(normalizedSvg("en")).toContain('width="1080"');
    expect(normalizedSvg("en")).toContain('height="1080"');
  });

  it("renders every wrapped line of the Arabic matn", () => {
    const svg = normalizedSvg("en");
    for (const line of wrapText(hadith.textAr, 26)) {
      expect(svg).toContain(escapeXml(line));
    }
  });

  it("renders every wrapped line of the English translation for English users", () => {
    const svg = normalizedSvg("en");
    for (const line of wrapText(hadith.textEn, 52)) {
      expect(svg).toContain(escapeXml(line));
    }
  });

  it("omits the English translation for Arabic-language users", () => {
    const svg = normalizedSvg("ar");
    for (const line of wrapText(hadith.textEn, 52)) {
      expect(svg).not.toContain(escapeXml(line));
    }
  });

  it("includes the source citation lines", () => {
    const svgEn = normalizedSvg("en");
    for (const line of wrapText(hadith.sourceEn, 60)) {
      expect(svgEn).toContain(escapeXml(line));
    }
    const svgAr = normalizedSvg("ar");
    for (const line of wrapText(hadith.sourceAr, 60)) {
      expect(svgAr).toContain(escapeXml(line));
    }
  });

  it("embeds the Arabic font as base64", () => {
    expect(normalizedSvg("en")).toContain("data:font/ttf;base64,");
  });

  it("sets rtl direction on Arabic text", () => {
    expect(normalizedSvg("en")).toContain('direction="rtl"');
  });
});

describe("escapeXml", () => {
  it("escapes XML special characters", () => {
    expect(escapeXml(`<a & b> "c" 'd'`)).toBe(
      "&lt;a &amp; b&gt; &quot;c&quot; &apos;d&apos;"
    );
  });
});

describe("wrapText", () => {
  it("keeps short text on one line", () => {
    expect(wrapText("short text", 20)).toEqual(["short text"]);
  });

  it("wraps long text into lines of at most maxChars", () => {
    const lines = wrapText("one two three four five six", 10);
    for (const line of lines) {
      expect(line.length).toBeLessThanOrEqual(10);
    }
    expect(lines.join(" ")).toBe("one two three four five six");
  });

  it("hard-breaks words longer than maxChars", () => {
    const lines = wrapText("supercalifragilistic", 8);
    expect(lines).toEqual(["supercal", "ifragili", "stic"]);
  });
});
