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
