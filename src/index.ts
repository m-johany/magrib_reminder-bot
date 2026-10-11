import { Bot, InlineKeyboard, InputFile, webhookCallback, type Context } from "grammy";
import resvgWasm from "@resvg/resvg-wasm/index_bg.wasm";
import { fetchPrayerTimes } from "./aladhan";
import { buildCardSvg } from "./card";
import {
  isGroupAdmin,
  pauseCommand,
  resumeCommand,
  setCityCommand,
  setLanguageCommand,
  statusCommand,
  testCommand,
  type UserStore,
} from "./commands";
import { runTick, type TickDeps } from "./cron";
import {
  adminOnlyText,
  groupWelcomeText,
  helpText,
  type HadithText,
  type Language,
  welcomeText,
} from "./messages";
import { renderCardPng } from "./image";
import { d1UserStore } from "./store";
import { resolveCityName } from "./geocode";
import { fetchRandomSahihHadith } from "./hadith-api";
import { parseWeekNumber, pickHadithIndex } from "./rotation";

export interface Env {
  TELEGRAM_BOT_TOKEN: string;
  DB: D1Database;
  HADITH_API_KEY?: string;
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

async function sendPhotoOrReply(
  sendFn: (photo: InputFile, caption: string) => Promise<unknown>,
  sendTextFn: (text: string) => Promise<unknown>,
  photo: Uint8Array,
  text: string
): Promise<void> {
  const MAX_CAPTION = 1024;
  if (text.length <= MAX_CAPTION) {
    await sendFn(new InputFile(photo, "al-kahf.png"), text);
    return;
  }
  const splitPoint = text.lastIndexOf("\n\n", MAX_CAPTION);
  const caption = splitPoint > 200 ? text.slice(0, splitPoint).trim() : text.slice(0, MAX_CAPTION - 3) + "...";
  const remaining = splitPoint > 200 ? text.slice(splitPoint).trim() : text;

  await sendFn(new InputFile(photo, "al-kahf.png"), caption);
  if (remaining) {
    await sendTextFn(remaining);
  }
}

function createBot(token: string, env: Env): Bot {
  const bot = new Bot(token);
  const store = d1UserStore(env.DB);

  async function ensureGroupAdmin(ctx: Context, store: UserStore): Promise<boolean> {
    const chat = ctx.chat;
    if (chat && chat.type === "private") return true;
    // Anonymous admins (sender_chat) cannot be identified -> blocked.
    if (!chat || !ctx.from || ctx.from.id === 777000) return false;
    const admin = await isGroupAdmin(
      (chatId, userId) => ctx.api.getChatMember(chatId, userId).then((m) => m.status),
      String(chat.id),
      ctx.from.id
    );
    if (admin) return true;
    const user = await store.get(String(chat.id));
    await ctx.reply(adminOnlyText(user?.language ?? "en"));
    return false;
  }

  bot.command("start", async (ctx) => {
    const user = await store.get(String(ctx.chat.id));
    const text =
      ctx.chat?.type === "private"
        ? welcomeText(user?.language ?? "en")
        : groupWelcomeText(user?.language ?? "en");
    await ctx.reply(text);
  });
  bot.command("help", async (ctx) => {
    const user = await store.get(String(ctx.chat.id));
    await ctx.reply(helpText(user?.language ?? "en"));
  });
  bot.command("setcity", async (ctx) => {
    if (!(await ensureGroupAdmin(ctx, store))) return;
    const reply = await setCityCommand(ctx.match, String(ctx.chat.id), {
      store,
      fetchPrayerTimes: (city, country) => fetchPrayerTimes(city, country),
      resolveCity: (city) => resolveCityName(city),
    });
    await ctx.reply(reply);
  });
  bot.command("setlanguage", async (ctx) => {
    if (!(await ensureGroupAdmin(ctx, store))) return;
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
    if (
      ctx.chat.type !== "private" &&
      (!ctx.from ||
        ctx.from.id === 777000 ||
        !(await isGroupAdmin(
          (chatId, userId) => ctx.api.getChatMember(chatId, userId).then((m) => m.status),
          String(ctx.chat.id),
          ctx.from.id
        )))
    ) {
      await ctx.answerCallbackQuery({
        text: adminOnlyText((await store.get(String(ctx.chat.id)))?.language ?? "en"),
      });
      return;
    }
    const lang = ctx.match[1] as Language;
    const reply = await setLanguageCommand(lang, String(ctx.chat.id), { store });
    await ctx.answerCallbackQuery();
    await ctx.reply(reply);
  });
  bot.command("pause", async (ctx) => {
    if (!(await ensureGroupAdmin(ctx, store))) return;
    const reply = await pauseCommand(String(ctx.chat.id), { store });
    await ctx.reply(reply);
  });
  bot.command("resume", async (ctx) => {
    if (!(await ensureGroupAdmin(ctx, store))) return;
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
      await sendPhotoOrReply(
        (photo, caption) => ctx.replyWithPhoto(photo, { caption }),
        (text) => ctx.reply(text),
        result.photo,
        result.text
      );
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
    async getHadithForWeek(weekKey: string): Promise<HadithText | null> {
      // 1. Check if we already selected a hadith for this week in weekly_hadith cache
      try {
        const cached = await env.DB.prepare(
          "SELECT text_en, text_ar, source_en, source_ar FROM weekly_hadith WHERE week_key = ?"
        )
          .bind(weekKey)
          .first<{
            text_en: string;
            text_ar: string;
            source_en: string;
            source_ar: string;
          }>();

        if (cached) {
          return {
            textEn: cached.text_en,
            textAr: cached.text_ar,
            sourceEn: cached.source_en,
            sourceAr: cached.source_ar,
          };
        }
      } catch {
        // Table may not exist yet, continue
      }

      // 2. If HADITH_API_KEY is available, fetch a random Sahih hadith from hadithapi.com
      if (env.HADITH_API_KEY) {
        try {
          // Get recent hadith keys (last 10 weeks) for deduplication
          let recentKeys: string[] = [];
          try {
            const rows = await env.DB.prepare(
              "SELECT hadith_key FROM weekly_hadith ORDER BY created_at DESC LIMIT 10"
            ).all<{ hadith_key: string }>();
            recentKeys = (rows.results ?? []).map((r) => r.hadith_key);
          } catch {
            // ignore if table doesn't exist yet
          }

          const fetched = await fetchRandomSahihHadith({
            apiKey: env.HADITH_API_KEY,
            recentKeys,
          });

          if (fetched) {
            // Cache selected hadith for this week in D1
            try {
              await env.DB.prepare(
                `CREATE TABLE IF NOT EXISTS weekly_hadith (
                  week_key TEXT PRIMARY KEY,
                  hadith_key TEXT NOT NULL,
                  text_en TEXT NOT NULL,
                  text_ar TEXT NOT NULL,
                  source_en TEXT NOT NULL,
                  source_ar TEXT NOT NULL,
                  created_at TEXT NOT NULL DEFAULT (datetime('now'))
                )`
              ).run();

              await env.DB.prepare(
                `INSERT OR REPLACE INTO weekly_hadith (week_key, hadith_key, text_en, text_ar, source_en, source_ar)
                 VALUES (?, ?, ?, ?, ?, ?)`
              )
                .bind(
                  weekKey,
                  fetched.hadithKey,
                  fetched.textEn,
                  fetched.textAr,
                  fetched.sourceEn,
                  fetched.sourceAr
                )
                .run();
            } catch (err) {
              console.warn("Failed to cache weekly hadith in D1:", err);
            }

            return {
              textEn: fetched.textEn,
              textAr: fetched.textAr,
              sourceEn: fetched.sourceEn,
              sourceAr: fetched.sourceAr,
            };
          }
        } catch (err) {
          console.warn("hadithapi.com fetch failed:", err);
        }
      }

      // 3. Fallback to D1 hadith table (seed data)
      const count = await this.countHadith();
      if (count > 0) {
        return this.getHadithByWeekOrder(pickHadithIndex(parseWeekNumber(weekKey), count));
      }
      return null;
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
        makeTickDeps(env, async (chatId, text, photo) => {
          if (photo) {
            await sendPhotoOrReply(
              (p, caption) => activeBot.api.sendPhoto(chatId, p, { caption }),
              (t) => activeBot.api.sendMessage(chatId, t),
              photo,
              text
            );
          } else {
            await activeBot.api.sendMessage(chatId, text);
          }
        })
      )
    );
  },
};
