import type { HadithText } from "./messages";

export interface HadithApiItem {
  id: number;
  hadithNumber: string;
  englishNarrator?: string | null;
  hadithEnglish?: string | null;
  hadithArabic?: string | null;
  status: string;
  bookSlug: string;
  book?: {
    id: number;
    bookName: string;
    bookSlug: string;
  };
}

export interface HadithApiResponse {
  status: number;
  message?: string;
  hadiths?: {
    data?: HadithApiItem[];
    total?: number;
  };
}

export interface SelectedHadith extends HadithText {
  hadithKey: string;
}

export const BOOK_NAMES_AR: Record<string, string> = {
  "sahih-bukhari": "صحيح البخاري",
  "sahih-muslim": "صحيح مسلم",
  "al-tirmidhi": "جامع الترمذي",
  "abu-dawood": "سنن أبي داود",
  "ibn-e-majah": "سنن ابن ماجه",
  "sunan-nasai": "سنن النسائي",
  "mishkat": "مشكاة المصابيح",
  "musnad-ahmad": "مسند أحمد",
  "al-silsila-sahiha": "السلسلة الصحيحة",
};

export function toArabicDigits(numStr: string): string {
  const digits = ["٠", "١", "٢", "٣", "٤", "٥", "٦", "٧", "٨", "٩"];
  return numStr.replace(/[0-9]/g, (d) => digits[Number(d)] ?? d);
}

export function formatHadith(item: HadithApiItem): SelectedHadith {
  const bookSlug = item.bookSlug || item.book?.bookSlug || "hadith";
  const bookNameEn = item.book?.bookName || bookSlug;
  const bookNameAr = BOOK_NAMES_AR[bookSlug] || bookNameEn;
  const hadithNumber = item.hadithNumber || String(item.id);

  const hadithKey = `${bookSlug}:${hadithNumber}`;
  const sourceEn = `${bookNameEn} ${hadithNumber}`;
  const sourceAr = `${bookNameAr} ${toArabicDigits(hadithNumber)}`;

  let textEn = (item.hadithEnglish || "").trim();
  const narrator = (item.englishNarrator || "").trim();
  if (narrator && !textEn.toLowerCase().startsWith(narrator.toLowerCase().slice(0, 15))) {
    textEn = `${narrator} ${textEn}`;
  }

  const textAr = (item.hadithArabic || "").trim();

  return {
    hadithKey,
    textEn,
    textAr,
    sourceEn,
    sourceAr,
  };
}

export interface FetchHadithOptions {
  apiKey: string;
  recentKeys?: string[];
  maxRetries?: number;
  fetchFn?: typeof fetch;
  randomFn?: () => number;
}

/**
 * Fetches a random Sahih hadith from hadithapi.com.
 * Retries if the hadith is too short, too long, missing translation, or was used recently.
 */
export async function fetchRandomSahihHadith(
  options: FetchHadithOptions
): Promise<SelectedHadith | null> {
  const {
    apiKey,
    recentKeys = [],
    maxRetries = 3,
    fetchFn = fetch,
    randomFn = Math.random,
  } = options;

  // Pages 1 to 26000 contain the six canonical Sahih collections with complete translations
  const MAX_PAGE = 26000;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const page = Math.floor(randomFn() * MAX_PAGE) + 1;
      const url = `https://hadithapi.com/api/hadiths?apiKey=${encodeURIComponent(
        apiKey
      )}&status=Sahih&page=${page}&paginate=1`;

      const res = await fetchFn(url);
      if (!res.ok) {
        continue;
      }

      const data = (await res.json()) as HadithApiResponse;
      const item = data.hadiths?.data?.[0];
      if (!item) {
        continue;
      }

      const formatted = formatHadith(item);
      const { hadithKey, textAr, textEn } = formatted;

      // 1. Length validation (must have substantive Arabic & English text)
      if (textAr.length < 25 || textEn.length < 25) {
        continue;
      }
      if (textAr.length > 1500 || textEn.length > 2000) {
        continue;
      }

      // 2. 10-week deduplication check
      if (recentKeys.includes(hadithKey)) {
        continue;
      }

      return formatted;
    } catch {
      // Retry on network/parse failure
    }
  }

  return null;
}
