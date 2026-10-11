import { describe, expect, it } from "vitest";
import {
  fetchRandomSahihHadith,
  formatHadith,
  toArabicDigits,
  type HadithApiItem,
} from "../src/hadith-api";

describe("toArabicDigits", () => {
  it("converts western digits to eastern Arabic digits", () => {
    expect(toArabicDigits("1234567890")).toBe("١٢٣٤٥٦٧٨٩٠");
    expect(toArabicDigits("Bukhari 809")).toBe("Bukhari ٨٠٩");
  });
});

describe("formatHadith", () => {
  it("formats canonical citations and texts properly", () => {
    const item: HadithApiItem = {
      id: 1,
      hadithNumber: "1",
      englishNarrator: "Narrated 'Umar:",
      hadithEnglish: "Actions are by intentions.",
      hadithArabic: "إنما الأعمال بالنيات",
      status: "Sahih",
      bookSlug: "sahih-bukhari",
      book: {
        id: 1,
        bookName: "Sahih Bukhari",
        bookSlug: "sahih-bukhari",
      },
    };

    const formatted = formatHadith(item);
    expect(formatted.hadithKey).toBe("sahih-bukhari:1");
    expect(formatted.sourceEn).toBe("Sahih Bukhari 1");
    expect(formatted.sourceAr).toBe("صحيح البخاري ١");
    expect(formatted.textEn).toBe("Narrated 'Umar: Actions are by intentions.");
    expect(formatted.textAr).toBe("إنما الأعمال بالنيات");
  });
});

describe("fetchRandomSahihHadith", () => {
  it("returns formatted hadith on valid API response", async () => {
    const mockItem: HadithApiItem = {
      id: 100,
      hadithNumber: "450",
      englishNarrator: "Narrated Abu Huraira:",
      hadithEnglish:
        "The strong believer is better and more beloved to Allah than the weak believer, while there is good in both.",
      hadithArabic:
        "الْمُؤْمِنُ الْقَوِيُّ خَيْرٌ وَأَحَبُّ إِلَى اللَّهِ مِنَ الْمُؤْمِنِ الضَّعِيفِ وَفِي كُلٍّ خَيْرٌ",
      status: "Sahih",
      bookSlug: "sahih-muslim",
      book: { id: 2, bookName: "Sahih Muslim", bookSlug: "sahih-muslim" },
    };

    const mockFetch = async () =>
      new Response(
        JSON.stringify({
          status: 200,
          hadiths: { data: [mockItem], total: 37000 },
        }),
        { status: 200 }
      );

    const result = await fetchRandomSahihHadith({
      apiKey: "test-key",
      fetchFn: mockFetch as unknown as typeof fetch,
      randomFn: () => 0.5,
    });

    expect(result).not.toBeNull();
    expect(result?.hadithKey).toBe("sahih-muslim:450");
    expect(result?.sourceEn).toBe("Sahih Muslim 450");
    expect(result?.sourceAr).toBe("صحيح مسلم ٤٥٠");
  });

  it("skips hadiths that are in recentKeys (10-week deduplication)", async () => {
    const item1: HadithApiItem = {
      id: 1,
      hadithNumber: "1",
      hadithEnglish: "First hadith translation with sufficient text length.",
      hadithArabic: "الحديث الأول بنص كاف ومناسب تماما",
      status: "Sahih",
      bookSlug: "sahih-bukhari",
    };
    const item2: HadithApiItem = {
      id: 2,
      hadithNumber: "2",
      hadithEnglish: "Second hadith translation with sufficient text length.",
      hadithArabic: "الحديث الثاني بنص كاف ومناسب تماما",
      status: "Sahih",
      bookSlug: "sahih-bukhari",
    };

    let callCount = 0;
    const mockFetch = async () => {
      callCount++;
      const item = callCount === 1 ? item1 : item2;
      return new Response(
        JSON.stringify({ status: 200, hadiths: { data: [item] } }),
        { status: 200 }
      );
    };

    const result = await fetchRandomSahihHadith({
      apiKey: "test-key",
      recentKeys: ["sahih-bukhari:1"], // item1 was sent recently
      fetchFn: mockFetch as unknown as typeof fetch,
    });

    expect(result).not.toBeNull();
    expect(result?.hadithKey).toBe("sahih-bukhari:2");
    expect(callCount).toBe(2);
  });

  it("retries when text is too short or missing translation", async () => {
    const emptyEn: HadithApiItem = {
      id: 1,
      hadithNumber: "1",
      hadithEnglish: "", // missing translation
      hadithArabic: "الحديث بنص كاف ومناسب تماما",
      status: "Sahih",
      bookSlug: "mishkat",
    };
    const validItem: HadithApiItem = {
      id: 2,
      hadithNumber: "2",
      hadithEnglish: "Valid hadith translation with sufficient length.",
      hadithArabic: "الحديث بنص كاف ومناسب تماما وصحيح",
      status: "Sahih",
      bookSlug: "sahih-bukhari",
    };

    let callCount = 0;
    const mockFetch = async () => {
      callCount++;
      const item = callCount === 1 ? emptyEn : validItem;
      return new Response(
        JSON.stringify({ status: 200, hadiths: { data: [item] } }),
        { status: 200 }
      );
    };

    const result = await fetchRandomSahihHadith({
      apiKey: "test-key",
      fetchFn: mockFetch as unknown as typeof fetch,
    });

    expect(result).not.toBeNull();
    expect(result?.hadithKey).toBe("sahih-bukhari:2");
  });

  it("returns null when all retries fail", async () => {
    const mockFetch = async () => new Response("Internal Server Error", { status: 500 });

    const result = await fetchRandomSahihHadith({
      apiKey: "test-key",
      maxRetries: 2,
      fetchFn: mockFetch as unknown as typeof fetch,
    });

    expect(result).toBeNull();
  });
});
