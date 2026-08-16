import { Bot, webhookCallback } from "grammy";
import { helpText, welcomeText } from "./messages";

export interface Env {
  TELEGRAM_BOT_TOKEN: string;
  DB: D1Database;
}

const COMMANDS = [
  { command: "start", description: "Welcome message and setup guide" },
  { command: "help", description: "List all commands" },
];

function createBot(token: string): Bot {
  const bot = new Bot(token);

  bot.command("start", (ctx) => ctx.reply(welcomeText("en")));
  bot.command("help", (ctx) => ctx.reply(helpText("en")));

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
      bot = createBot(env.TELEGRAM_BOT_TOKEN);
      botToken = env.TELEGRAM_BOT_TOKEN;
    }
    return webhookCallback(bot, "cloudflare-mod")(request);
  },
};
