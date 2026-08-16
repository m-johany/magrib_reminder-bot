import { Bot, webhookCallback } from "grammy";
import { fetchPrayerTimes } from "./aladhan";
import { setCityCommand, statusCommand } from "./commands";
import { helpText, welcomeText } from "./messages";
import { d1UserStore } from "./store";

export interface Env {
  TELEGRAM_BOT_TOKEN: string;
  DB: D1Database;
}

const COMMANDS = [
  { command: "start", description: "Welcome message and setup guide" },
  { command: "setcity", description: "Set your city, e.g. /setcity London, UK" },
  { command: "status", description: "Show your current settings" },
  { command: "help", description: "List all commands" },
];

function createBot(token: string, env: Env): Bot {
  const bot = new Bot(token);
  const store = d1UserStore(env.DB);

  bot.command("start", (ctx) => ctx.reply(welcomeText("en")));
  bot.command("help", (ctx) => ctx.reply(helpText("en")));
  bot.command("setcity", async (ctx) => {
    const reply = await setCityCommand(ctx.match, String(ctx.chat.id), {
      store,
      fetchPrayerTimes: (city, country) => fetchPrayerTimes(city, country),
    });
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
