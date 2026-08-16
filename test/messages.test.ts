import { describe, expect, it } from "vitest";
import { helpText, welcomeText } from "../src/messages";

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
