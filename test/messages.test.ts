import { describe, expect, it } from "vitest";
import {
  adminOnlyText,
  cityNotFoundText,
  citySetText,
  groupWelcomeText,
  helpText,
  languageSetText,
  noCityText,
  pausedText,
  reminderText,
  resumedText,
  statusText,
  welcomeText,
} from "../src/messages";

const hadith = {
  textEn: "Whoever recites Surah al-Kahf on Friday, a light will shine for him between the two Fridays.",
  textAr: "مَنْ قَرَأَ سُورَةَ الْكَهْفِ يَوْمَ الْجُمُعَةِ أَضَاءَ لَهُ مِنَ النُّورِ مَا بَيْنَ الْجُمُعَتَيْنِ",
  sourceEn: "Al-Mustadrak 2/399; graded sahih by al-Albani, Sahih al-Jami' 6470",
  sourceAr: "المستدرك ٢/٣٩٩، وصححه الألباني في صحيح الجامع ٦٤٧٠",
};

describe("welcomeText", () => {
  it("opens with Islamic greeting in English", () => {
    expect(welcomeText("en")).toContain("As-salamu alaykum");
  });

  it("explains the bot's purpose", () => {
    expect(welcomeText("en")).toContain("Surah al-Kahf");
  });

  it("prompts the user to set city and language", () => {
    const text = welcomeText("en");
    expect(text).toContain("/setcity");
    expect(text).toContain("/setlanguage");
  });

  it("has an Arabic variant with appropriate Islamic phrasing", () => {
    expect(welcomeText("ar")).toContain("السلام عليكم");
    expect(welcomeText("ar")).toContain("سورة الكهف");
  });
});

describe("helpText", () => {
  it("lists all commands", () => {
    const text = helpText("en");
    const commands = [
      "/start",
      "/setcity",
      "/setlanguage",
      "/pause",
      "/resume",
      "/status",
      "/help",
    ];
    for (const cmd of commands) {
      expect(text).toContain(cmd);
    }
  });

  it("has an Arabic variant listing all commands", () => {
    const text = helpText("ar");
    expect(text).toContain("/setcity");
    expect(text).toContain("/help");
  });
});

describe("citySetText", () => {
  it("confirms the stored city", () => {
    expect(citySetText("en", "London", "UK")).toBe("Your city is set to London, UK");
  });

  it("has an Arabic variant", () => {
    expect(citySetText("ar", "London", "UK")).toContain("London");
  });
});

describe("cityNotFoundText", () => {
  it("matches the agreed retry format", () => {
    expect(cityNotFoundText("en")).toBe(
      "I couldn't find that city. Please try again with format: /setcity London, UK"
    );
  });
});

describe("noCityText", () => {
  it("guides to /setcity", () => {
    expect(noCityText("en")).toBe("No city set. Use /setcity to configure");
  });
});

describe("statusText", () => {
  it("shows the stored city and country", () => {
    const text = statusText("en", { city: "London", country: "UK", language: "en", paused: false });
    expect(text).toContain("London, UK");
  });

  it("shows language and active state", () => {
    const text = statusText("en", { city: "London", country: "UK", language: "ar", paused: false });
    expect(text).toContain("العربية");
    expect(text).toContain("Active");
  });

  it("shows paused state when paused", () => {
    const text = statusText("en", { city: "London", country: "UK", language: "en", paused: true });
    expect(text).toContain("Paused");
  });
});

describe("languageSetText", () => {
  it("confirms English selection", () => {
    expect(languageSetText("en")).toContain("English");
  });

  it("confirms Arabic selection in Arabic", () => {
    expect(languageSetText("ar")).toContain("العربية");
  });
});

describe("pausedText / resumedText", () => {
  it("confirms pause", () => {
    expect(pausedText("en")).toContain("/resume");
  });

  it("confirms resume", () => {
    expect(resumedText("en")).toContain("resumed");
  });

  it("has Arabic variants", () => {
    expect(pausedText("ar")).toContain("إيقاف");
    expect(resumedText("ar")).toContain("استئناف");
  });
});

describe("reminderText", () => {
  it("includes the hadith text and source citation", () => {
    const text = reminderText("en", "London", hadith);
    expect(text).toContain("light will shine");
    expect(text).toContain("Sahih al-Jami' 6470");
  });

  it("shows the Arabic matn alongside the translation", () => {
    const text = reminderText("en", "London", hadith);
    expect(text).toContain("سُورَةَ الْكَهْفِ");
  });

  it("works without a hadith (plain reminder)", () => {
    const text = reminderText("en", "London", null);
    expect(text).toContain("Surah al-Kahf");
    expect(text).not.toContain("Hadith");
  });

  it("uses the Arabic source for Arabic-language users", () => {
    const text = reminderText("ar", "London", hadith);
    expect(text).toContain("صحيح الجامع");
  });
});

describe("groupWelcomeText", () => {
  it("explains admin setup commands in English", () => {
    const text = groupWelcomeText("en");
    expect(text).toContain("/setcity");
    expect(text).toContain("/setlanguage");
  });

  it("has an Arabic variant mentioning the group", () => {
    expect(groupWelcomeText("ar")).toContain("المجموعة");
  });
});

describe("adminOnlyText", () => {
  it("warns in English", () => {
    expect(adminOnlyText("en")).toBe("Only group admins can change this group's settings.");
  });

  it("has an Arabic variant", () => {
    expect(adminOnlyText("ar")).toContain("مدراء");
  });
});
