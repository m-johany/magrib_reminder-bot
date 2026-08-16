import { Bot, InlineKeyboard, webhookCallback } from "grammy";
import { fetchPrayerTimes } from "./aladhan";
import {
  pauseCommand,
  resumeCommand,
  setCityCommand,
  setLanguageCommand,
  statusCommand,
} from "./commands";
import { helpText, type Language, welcomeText } from "./messages";
import { d1UserStore } from "./store";

export interface Env {
  TELEGRAM_BOT_TOKEN: string;
  DB: D1Database;
}

const COMMANDS = [
  { command: "start", description: "Welcome message and setup guide" },
  { command: "setcity", description: "Set your city, e.g. /setcity London, UK" },
  { command: "setlanguage", description: "Choose English or العربية" },
  { command: "pause", description: "Pause reminders" },
  { command: "resume", description: "Resume reminders" },
  { command: "status", description: "Show your current settings" },
  { command: "help", description: "List all commands" },
];

function createBot(token: string, env: Env): Bot {
  const bot = new Bot(token);
  const store = d1UserStore(env.DB);

  bot.command("start", async (ctx) => {
    const user = await store.get(String(ctx.chat.id));
    await ctx.reply(welcomeText(user?.language ?? "en"));
  });
  bot.command("help", async (ctx) => {
    const user = await store.get(String(ctx.chat.id));
    await ctx.reply(helpText(user?.language ?? "en"));
  });
  bot.command("setcity", async (ctx) => {
    const reply = await setCityCommand(ctx.match, String(ctx.chat.id), {
      store,
      fetchPrayerTimes: (city, country) => fetchPrayerTimes(city, country),
    });
    await ctx.reply(reply);
  });
  bot.command("setlanguage", async (ctx) => {
    const keyboard = new InlineKeyboard()
      .text("English", "lang:en")
      .text("العربية", "lang:ar");
    const user = await store.get(String(ctx.chat.id));
    const prompt =
      user?.language === "ar"
        ? "اختر لغتك المفضلة:"
        : "Choose your preferred language:";
    await ctx.reply(prompt, { reply_markup: keyboard });
  });
  bot.callbackQuery(/^lang:(en|ar)$/, async (ctx) => {
    if (!ctx.chat) {
      await ctx.answerCallbackQuery({ text: "Error: no chat" });
      return;
    }
    const lang = ctx.match[1] as Language;
    const reply = await setLanguageCommand(lang, String(ctx.chat.id), { store });
    await ctx.answerCallbackQuery();
    await ctx.reply(reply);
  });
  bot.command("pause", async (ctx) => {
    const reply = await pauseCommand(String(ctx.chat.id), { store });
    await ctx.reply(reply);
  });
  bot.command("resume", async (ctx) => {
    const reply = await resumeCommand(String(ctx.chat.id), { store });
    await ctx.reply(reply);
  });
  bot.command("status", async (ctx) => {
    const reply = await statusCommand(String(ctx.chat.id), { store });
    await ctx.reply(reply);
  });

  // Register commands with Telegram so they appear in the client UI.
  void bot.api
    .setMyCommands(COMMANDS)
    .catch((err: unknown) => console.error("setMyCommands failed", err));

  return bot;
}

let bot: Bot | undefined;
let botToken: string | undefined;

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (bot === undefined || botToken !== env.TELEGRAM_BOT_TOKEN) {
      bot = createBot(env.TELEGRAM_BOT_TOKEN, env);
      botToken = env.TELEGRAM_BOT_TOKEN;
    }
    return webhookCallback(bot, "cloudflare-mod")(request);
  },
};
