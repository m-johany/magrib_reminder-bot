import { Bot, InlineKeyboard, webhookCallback } from "grammy";
import { fetchPrayerTimes } from "./aladhan";
import {
  pauseCommand,
  resumeCommand,
  setCityCommand,
  setLanguageCommand,
  statusCommand,
} from "./commands";
import { runTick, type TickDeps } from "./cron";
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

function makeTickDeps(env: Env, sendMessage: (chatId: string, text: string) => Promise<unknown>): TickDeps {
  const logError = (message: string, err?: unknown) =>
    console.error(JSON.stringify({ level: "error", message, error: String(err ?? "") }));

  return {
    async listActiveUsers() {
      const { results } = await env.DB.prepare(
        `SELECT id, telegram_chat_id, city, country, language, paused
         FROM users
         WHERE paused = 0 AND city IS NOT NULL AND city != ''`
      ).all<{
        id: number;
        telegram_chat_id: string;
        city: string;
        country: string;
        language: string;
        paused: number;
      }>();
      return results.map((r) => ({
        id: r.id,
        telegram_chat_id: r.telegram_chat_id,
        city: r.city,
        country: r.country,
        language: r.language === "ar" ? "ar" : "en",
        paused: r.paused !== 0,
      }));
    },
    fetchTimings(city, country, dateEn) {
      return fetchPrayerTimes(city, country, dateEn ?? undefined);
    },
    async sendReminder(chatId, text) {
      await sendMessage(chatId, text);
    },
    async alreadySent(userId, weekKey) {
      const row = await env.DB.prepare(
        "SELECT COUNT(*) AS n FROM sent_log WHERE user_id = ? AND week_key = ?"
      )
        .bind(userId, weekKey)
        .first<{ n: number }>();
      return (row?.n ?? 0) > 0;
    },
    async recordSend(userId, hadithId, weekKey) {
      await env.DB.prepare(
        "INSERT INTO sent_log (user_id, hadith_id, week_key) VALUES (?, ?, ?)"
      )
        .bind(userId, hadithId, weekKey)
        .run();
    },
    logError,
  };
}

let bot: Bot | undefined;
let botToken: string | undefined;

function getBot(env: Env): Bot {
  if (bot === undefined || botToken !== env.TELEGRAM_BOT_TOKEN) {
    bot = createBot(env.TELEGRAM_BOT_TOKEN, env);
    botToken = env.TELEGRAM_BOT_TOKEN;
  }
  return bot;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    return webhookCallback(getBot(env), "cloudflare-mod")(request);
  },
  scheduled(_event: ScheduledEvent, env: Env, ctx: ExecutionContext): void {
    const activeBot = getBot(env);
    ctx.waitUntil(runTick(new Date(), makeTickDeps(env, (chatId, text) => activeBot.api.sendMessage(chatId, text))));
  },
};
