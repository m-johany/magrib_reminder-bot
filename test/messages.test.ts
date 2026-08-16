import { describe, expect, it } from "vitest";
import {
  cityNotFoundText,
  citySetText,
  helpText,
  noCityText,
  statusText,
  welcomeText,
} from "../src/messages";

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
});
