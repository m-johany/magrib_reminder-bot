# Al-Kahf Bot 🌙

A Telegram bot that sends personalized Thursday-after-Maghrib reminders to recite Surah al-Kahf, with dynamically generated image cards featuring a rotating hadith on the surah's virtues.

Runs on Cloudflare Workers with D1 (SQLite), Cron Triggers, and the Aladhan API. Full spec: [SPEC.md](SPEC.md).

## User guide

### Getting started

1. Open a chat with the bot (or add it to a group).
2. Send `/start` — the bot walks you through setup.
3. Set your city. A bare city name works for most cities worldwide: `/setcity Dhaka`. Use `/setcity London, UK` to be explicit. The bot confirms with the resolved country: "Your city is set to Dhaka, Bangladesh".
4. Pick a language: `/setlanguage` → English or العربية.
5. Done. Every Thursday after Maghrib (at your city's time) you receive the weekly Surah al-Kahf reminder card.

### Commands

| Command | What it does |
|---------|--------------|
| `/start` | Welcome message and setup guide |
| `/setcity Dhaka` | Set your city; bare city names auto-resolve the country |
| `/setcity London, UK` | Set your city with an explicit country |
| `/setlanguage` | Choose English or العربية |
| `/pause` / `/resume` | Stop / restart reminders |
| `/status` | Show your city, language, and reminder state |
| `/test` | Preview this week's reminder card (does not affect the real one) |
| `/help` | List all commands |

### In groups

- One city per group, chosen by an admin. `/setcity`, `/setlanguage`, `/pause`, and `/resume` are admin-only — non-admins get "Only group admins can change this group's settings."
- Everyone in the group sees the same reminder at the group city's time. Want reminders at your own local time? Message the bot privately.
- `/status` and `/help` work for any member.
- Anonymous admins (identity hidden) are treated as non-admins; configure the group with your identity shown.
- The group's language defaults to English until an admin runs `/setlanguage`.

### Reminder timing and data

- The reminder fires on Thursday after Maghrib at your city's time (within a ~15-minute window). Each week's card features a rotating hadith on the virtues of Surah al-Kahf.
- The bot stores only your chat id, city, country, language, and pause state, plus a record of which weekly reminder was sent (to prevent duplicates). Nothing else.

## Architecture

```
Telegram user → Webhook → Worker (fetch handler)
                              ├── /start /help /setcity /setlanguage
                              ├── /pause /resume /status
                              └── language keyboard callbacks

Cron Trigger (every 10 min) → Worker (scheduled handler)
  ├── Unpaused users with a city set (D1)
  ├── Deduplicated Aladhan fetches (one per city per date)
  ├── Thursday + 15-minute Maghrib window detection
  ├── Weekly hadith rotation: week_number % hadith_count
  ├── SVG card rendered to PNG (resvg-wasm, Noto Naskh Arabic)
  └── sendPhoto with warm caption (text-only fallback on image failure)
```

## Local development

```bash
npm install
npm run db:migrate:local    # apply D1 migrations to local DB
npm run db:seed:local       # seed the hadith table
npm test                    # vitest unit tests
npm run typecheck
npm run dev                 # wrangler dev (webhook needs a tunnel for Telegram)
```

## Deployment

1. **Create the D1 database** (once):
   ```bash
   npx wrangler d1 create al-kahf-db
   ```
   Copy the printed `database_id` into `wrangler.jsonc` (`d1_databases[0].database_id`).

2. **Set the bot token secret** (once, or to rotate):
   ```bash
   npx wrangler secret put TELEGRAM_BOT_TOKEN
   ```
   Get the token from [@BotFather](https://t.me/BotFather). It never leaves Workers as a secret — no other API keys are used (Aladhan is open).

3. **Deploy + migrate + seed**:
   ```bash
   npm run deploy
   npm run db:migrate:remote
   npm run db:seed:remote
   ```

4. **Register the webhook** (once, after first deploy):
   ```bash
   curl "https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://<your-worker-url>/"
   ```

## Reliability behavior

- **Aladhan failure:** each city fetch retries once after 30s; if it still fails the city is skipped for that tick and logged. The next tick (10 min later) retries fresh.
- **Image generation failure:** the reminder falls back to text-only with the hadith in plain text — never silent.
- **Per-user isolation:** one user's Telegram failure never blocks another user's send in the same tick.
- **Duplicate prevention:** `sent_log` records the ISO week key per user; a user never receives two reminders in the same week.
- **Invalid city:** `/setcity` replies with the format guide — a bare city name (e.g. `/setcity Dhaka`) or explicit `City, Country` (e.g. `/setcity London, UK`).

## Logs

Worker logs are structured JSON lines (`wrangler tail` / Workers dashboard):

```json
{ "level": "error", "message": "Reminder send failed for user 1", "error": "...", "chat_id": "123456" }
{ "level": "warn", "message": "Aladhan fetch failed for London|UK, retrying in 30000ms", "error": "..." }
```

Context is limited to chat_id / city — no personal data.

## Cold start measurement

Cloudflare Workers cron triggers are expected to cold-start in <5ms (no warm-up needed). To verify on your deployed Worker: `wrangler tail` and inspect the invocation `duration` in the Workers dashboard for a scheduled event. If rendering pushes wall time up, that's billed CPU per request, not cold start.

## Font

Arabic rendering uses Noto Naskh Arabic (OFL), embedded as base64 in `src/font.ts` via:

```bash
node scripts/embed-font.mjs
```

The source TTF lives in `assets/`. If you replace it, re-run the embed script.

## Hadith data

`db/seed.sql` holds 8 authentic (sahih/hasan) hadith on the virtues of Surah al-Kahf with Arabic matn, English translation, and sources.

Rotation: active hadith = `week_order[week_number % count]` — global per week, every user sees the same hadith.
