import { Bot, InlineKeyboard, InputFile, webhookCallback } from "grammy";
import resvgWasm from "@resvg/resvg-wasm/index_bg.wasm";
import { fetchPrayerTimes } from "./aladhan";
import { buildCardSvg } from "./card";
import {
  pauseCommand,
  resumeCommand,
  setCityCommand,
  setLanguageCommand,
  statusCommand,
  testCommand,
} from "./commands";
import { runTick, type TickDeps } from "./cron";
import { helpText, type HadithText, type Language, welcomeText } from "./messages";
import { renderCardPng } from "./image";
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
  { command: "test", description: "Send a test preview of this week's reminder" },
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
  bot.command("test", async (ctx) => {
    const result = await testCommand(String(ctx.chat.id), {
      store,
      fetchPrayerTimes: (city, country) => fetchPrayerTimes(city, country),
      ...makeHadithDeps(env),
    });
    if (result.photo) {
      await ctx.replyWithPhoto(new InputFile(result.photo, "al-kahf.png"), {
        caption: result.text,
      });
    } else {
      await ctx.reply(result.text);
    }
  });

  // Register commands with Telegram so they appear in the client UI.
  void bot.api
    .setMyCommands(COMMANDS)
    .catch((err: unknown) => console.error("setMyCommands failed", err));

  return bot;
}

/** Hadith selection + card rendering, shared by the cron tick and /test. */
function makeHadithDeps(env: Env) {
  return {
    async countHadith(): Promise<number> {
      const row = await env.DB.prepare("SELECT COUNT(*) AS n FROM hadith").first<{ n: number }>();
      return row?.n ?? 0;
    },
    async getHadithByWeekOrder(weekOrder: number) {
      const row = await env.DB.prepare(
        "SELECT id, text_en, text_ar, source_en, source_ar FROM hadith WHERE week_order = ?"
      )
        .bind(weekOrder)
        .first<{
          id: number;
          text_en: string;
          text_ar: string;
          source_en: string;
          source_ar: string;
        }>();
      return row
        ? {
            id: row.id,
            textEn: row.text_en,
            textAr: row.text_ar,
            sourceEn: row.source_en,
            sourceAr: row.source_ar,
          }
        : null;
    },
    createImage(hadith: HadithText, lang: Language): Promise<Uint8Array> {
      return renderCardPng(buildCardSvg(hadith, lang), () => Promise.resolve(resvgWasm));
    },
  };
}

function makeTickDeps(
  env: Env,
  sendMessage: (chatId: string, text: string, photo?: Uint8Array) => Promise<unknown>
): TickDeps {
  const logError = (message: string, err?: unknown, context?: { chat_id?: string }) =>
    console.error(
      JSON.stringify({ level: "error", message, error: String(err ?? ""), ...context })
    );
  const logWarn = (message: string, err?: unknown) =>
    console.warn(JSON.stringify({ level: "warn", message, error: String(err ?? "") }));

  return {
    ...makeHadithDeps(env),
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
    async sendReminder(chatId, text, photo) {
      await sendMessage(chatId, text, photo);
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
    sleep(ms) {
      const { promise, resolve } = Promise.withResolvers<void>();
      setTimeout(resolve, ms);
      return promise;
    },
    logError,
    logWarn,
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
    ctx.waitUntil(
      runTick(
        new Date(),
        makeTickDeps(env, (chatId, text, photo) =>
          photo
            ? activeBot.api.sendPhoto(chatId, new InputFile(photo, "al-kahf.png"), { caption: text })
            : activeBot.api.sendMessage(chatId, text)
        )
      )
    );
  },
};
