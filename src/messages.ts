export type Language = "en" | "ar";

const COMMAND_LIST_EN = [
  ["/start", "Welcome message and setup guide"],
  ["/setcity London, UK", "Set your city for accurate Maghrib times"],
  ["/setlanguage", "Choose English or العربية"],
  ["/pause", "Pause reminders temporarily"],
  ["/resume", "Resume reminders"],
  ["/status", "Show your current settings"],
  ["/help", "List all commands"],
] as const;

const COMMAND_LIST_AR: readonly (readonly [string, string])[] = [
  ["/start", "رسالة ترحيبية ودليل الإعداد"],
  ["/setcity لندن, UK", "حدد مدينتك لأوقات المغرب الصحيحة"],
  ["/setlanguage", "اختر English أو العربية"],
  ["/pause", "إيقاف التذكيرات مؤقتًا"],
  ["/resume", "استئناف التذكيرات"],
  ["/status", "عرض إعداداتك الحالية"],
  ["/help", "عرض جميع الأوامر"],
];

export function welcomeText(lang: Language): string {
  if (lang === "ar") {
    return [
      "السلام عليكم ورحمة الله وبركاته 🌙",
      "",
      "أنا بوت الكهف — أذكّرك بقراءة سورة الكهف كل يوم جمعة، ويبدأ الوقت من ليلة الجمعة بعد المغرب.",
      "",
      "للبدء:",
      "1. حدّد مدينتك: /setcity",
      "2. اختر لغتك المفضلة: /setlanguage",
      "",
      "ثم اترك الباقي لي، وسأرسل لك تذكيرًا أسبوعيًا في وقته بإذن الله.",
    ].join("\n");
  }

  return [
    "As-salamu alaykum 👋",
    "",
    "I'm Al-Kahf Bot — I remind you to recite Surah al-Kahf every Friday, which begins Thursday after Maghrib.",
    "",
    "To get started:",
    "1. Set your city: /setcity",
    "2. Choose your preferred language: /setlanguage",
    "",
    "Then leave the rest to me — I'll send you a weekly reminder at the right time, insha'Allah.",
  ].join("\n");
}

export function helpText(lang: Language): string {
  const lines = (lang === "ar" ? COMMAND_LIST_AR : COMMAND_LIST_EN).map(
    ([cmd, desc]) => `${cmd} — ${desc}`
  );
  const header =
    lang === "ar"
      ? "الأوامر المتاحة:"
      : "Here's what I can do:";
  return [header, "", ...lines].join("\n");
}

export function citySetText(lang: Language, city: string, country: string): string {
  if (lang === "ar") {
    return `تم حفظ مدينتك: ${city}, ${country} ✅`;
  }
  return `Your city is set to ${city}, ${country}`;
}

export function cityNotFoundText(lang: Language): string {
  if (lang === "ar") {
    return "لم أجد هذه المدينة. جرّب مرة أخرى بهذه الصيغة: /setcity لندن, UK";
  }
  return "I couldn't find that city. Please try again with format: /setcity London, UK";
}

export function noCityText(lang: Language): string {
  if (lang === "ar") {
    return "لم تحدد مدينة بعد. استخدم /setcity للضبط";
  }
  return "No city set. Use /setcity to configure";
}

export function statusText(
  lang: Language,
  user: { city: string; country: string; language: Language; paused: boolean }
): string {
  const langName = user.language === "ar" ? "العربية" : "English";
  if (lang === "ar") {
    const state = user.paused ? "متوقفة" : "مفعّلة";
    return [
      `🏙️ المدينة: ${user.city}, ${user.country}`,
      `🗣️ اللغة: ${langName}`,
      `⏸️ التذكيرات: ${state}`,
    ].join("\n");
  }
  const state = user.paused ? "Paused" : "Active";
  return [
    `🏙️ City: ${user.city}, ${user.country}`,
    `🗣️ Language: ${langName}`,
    `⏸️ Reminders: ${state}`,
  ].join("\n");
}

export function languageSetText(lang: Language): string {
  if (lang === "ar") {
    return "تم اختيار اللغة: العربية ✅";
  }
  return "Language set to English ✅";
}

export function pausedText(lang: Language): string {
  if (lang === "ar") {
    return "تم إيقاف التذكيرات مؤقتًا. أرسل /resume لاستئنافها في أي وقت.";
  }
  return "Reminders paused. Send /resume anytime to restart them.";
}

export function resumedText(lang: Language): string {
  if (lang === "ar") {
    return "تم استئناف التذكيرات ✅. نلتقي ليلة الجمعة بعد المغرب بإذن الله 🌙";
  }
  return "Reminders resumed ✅. See you Thursday after Maghrib, insha'Allah 🌙";
}

export interface HadithText {
  textEn: string;
  textAr: string;
  sourceEn: string;
  sourceAr: string;
}

export function reminderText(lang: Language, city: string, hadith: HadithText | null = null): string {
  const hadithBlock = hadith
    ? lang === "ar"
      ? [
          "",
          "━━━━━━━━━━━━━",
          "📜 حديث الأسبوع:",
          "",
          hadith.textAr,
          "",
          `المصدر: ${hadith.sourceAr}`,
        ].join("\n")
      : [
          "",
          "━━━━━━━━━━━━━",
          "📜 Hadith of the week:",
          "",
          hadith.textAr,
          "",
          `"${hadith.textEn}"`,
          "",
          `— ${hadith.sourceEn}`,
        ].join("\n")
    : "";

  if (lang === "ar") {
    return [
      "السلام عليكم ورحمة الله وبركاته 🌙",
      "",
      `حان وقت قراءة سورة الكهف — إنها ليلة الجمعة في ${city} بعد المغرب.`,
      "",
      "لا تنسَ قراءة سورة الكهف اليوم، فقد حثّ عليها النبي ﷺ. تقبّل الله منا ومنكم.",
      hadithBlock,
    ].join("\n");
  }
  return [
    "As-salamu alaykum 🌙",
    "",
    `It's Thursday after Maghrib in ${city} — the night of Jumu'ah has begun.`,
    "",
    "Don't forget to recite Surah al-Kahf today, as the Prophet ﷺ encouraged. May Allah accept it from you.",
    hadithBlock,
  ].join("\n");
}
