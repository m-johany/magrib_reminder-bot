# AGENTS.md — Al-Kahf Bot

Context file for starting work on this project from any fresh session.

## What this is

A Telegram bot that sends personalized Thursday-after-Maghrib reminders to recite Surah al-Kahf, with dynamically generated images featuring rotating hadith on the surah's virtues. Multi-user, multi-language (English/Arabic), warm spiritual tone.

## Repo

- **GitHub:** https://github.com/m-johany/magrib_reminder-bot
- **Local:** `D:\Projects\al-kahf_bot`
- **Issue tracker:** GitHub Issues on the repo
- **Spec:** `D:\Projects\al-kahf_bot\SPEC.md`

## Tickets (linear chain — work in order)

1. **[Project scaffold + /start + /help](https://github.com/m-johany/magrib_reminder-bot/issues/1)** — wrangler init, TypeScript, D1 binding, Telegram webhook, /start and /help commands. No blockers.
2. **[User city + /setcity + /status](https://github.com/m-johany/magrib_reminder-bot/issues/2)** — D1 users table, /setcity validates via Aladhan, /status. Blocked by #1.
3. **[Language + pause/resume](https://github.com/m-johany/magrib_reminder-bot/issues/3)** — /setlanguage inline keyboard, /pause /resume, language+paused columns. Blocked by #2.
4. **[Cron scheduler + reminder dispatch](https://github.com/m-johany/magrib_reminder-bot/issues/4)** — 10-min Cron Trigger, deduplicated Aladhan calls, Thursday+Maghrib detection, text reminders, sent_log. Blocked by #3.
5. **[Hadith seed data + rotation](https://github.com/m-johany/magrib_reminder-bot/issues/5)** — D1 hadith table, 10-20 authentic hadith, weekly rotation (week_number % count). Blocked by #4.
6. **[Image generation](https://github.com/m-johany/magrib_reminder-bot/issues/6)** — SVG template, @resvg/resvg-wasm, arabic font bundled, sendPhoto. Blocked by #5.
7. **[Hardening](https://github.com/m-johany/magrib_reminder-bot/issues/7)** — retry logic, fallback to text on image failure, per-user error isolation, logging. Blocked by #6.

## Tech stack

| Layer | Choice |
|-------|--------|
| Platform | Cloudflare Workers |
| Deploy | Wrangler (`wrangler deploy`) |
| Language | TypeScript (`@cloudflare/workers-types`) |
| Database | D1 (SQLite) |
| Scheduling | Workers Cron Triggers (every 10 min) |
| Prayer times | Aladhan API (`api.aladhan.com/v1/timingsByCity`) — free, no auth |
| Telegram SDK | `grammy` or raw fetch to Bot API |
| Image gen | SVG template + `@resvg/resvg-wasm` → PNG |
| Arabic font | Noto Naskh Arabic (bundled base64) |

## Architecture

```
Telegram user → Webhook → Worker (main handler)
                              ├── /start, /help, /setcity, /setlanguage, /pause, /resume, /status
                              └── (commands handled inline)

Cron Trigger (every 10 min) → Worker (scheduled handler)
  ├── Query D1 for unpaused users with city set
  ├── Deduplicate cities → fetch Maghrib from Aladhan (one per city)
  ├── Filter: is Thursday AND Maghrib passed within this 10-min window
  ├── Generate hadith image (or fallback text)
  └── sendPhoto to each matching user via Telegram Bot API
```

## D1 Schema

```sql
CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  telegram_chat_id TEXT UNIQUE NOT NULL,
  city TEXT NOT NULL,
  country TEXT NOT NULL,
  language TEXT NOT NULL DEFAULT 'en' CHECK(language IN ('en', 'ar')),
  paused INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE hadith (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  week_order INTEGER NOT NULL,
  text_en TEXT NOT NULL,
  text_ar TEXT NOT NULL,
  source_en TEXT NOT NULL,
  source_ar TEXT NOT NULL
);

CREATE TABLE sent_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  hadith_id INTEGER NOT NULL REFERENCES hadith(id),
  sent_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

## Bot commands

| Command | Behavior |
|---------|----------|
| /start | Welcome + prompt set city/language |
| /setcity London, UK | Validate via Aladhan, store, confirm |
| /setlanguage | Inline keyboard: English / العربية |
| /pause | Halt reminders, confirm |
| /resume | Resume reminders, confirm |
| /status | Show city, language, paused state |
| /help | List all commands |

Register via Telegram `setMyCommands` on deploy.

## Key design decisions

- **Scheduling:** 10-minute cron instead of queue-based. Simpler, fits free tier.
- **City lookup:** Free-text via Aladhan, no geocoding needed. User types "London, UK".
- **Rotation:** `week_number % hadith_count` — deterministic, global, not per-user.
- **Image:** SVG→PNG in Worker. Single template, text overlaid. 1080×1080.
- **Fallback:** Image gen fails → text-only reminder. Never silent failure.
- **Isolation:** One user's failure never blocks another user's send.
- **Tone:** Warm, spiritual. Uses "ﷺ", Islamic greetings, appropriate in both languages.
- **Hadith source:** Config-curated, seeded via SQL. Designed for future API swap.

## Environment setup

```bash
# Prerequisites
npm install -g wrangler

# Clone
git clone https://github.com/m-johany/magrib_reminder-bot.git
cd magrib_reminder-bot

# D1
wrangler d1 create al-kahf-db

# Secrets
wrangler secret put TELEGRAM_BOT_TOKEN

# Deploy
wrangler deploy

# Seed hadith
wrangler d1 execute al-kahf-db --file=./db/seed.sql
```

## APIs used

- **Aladhan:** `GET https://api.aladhan.com/v1/timingsByCity?city=London&country=UK&method=2` — returns JSON with `data.timings.Maghrib` and `data.date.gregorian.weekday.en`
- **Telegram Bot API:** Webhook for updates, `sendMessage`, `sendPhoto`, `setMyCommands`
- No auth keys needed beyond `TELEGRAM_BOT_TOKEN` (Aladhan is free/open)

## Out of scope

- Admin dashboard / web UI
- Group chat support (DM only initially)
- Hijri calendar integration
- Dynamic hadith API (config-based only)
- Multiple prayer calculation methods (ISNA only)
- Analytics / usage tracking beyond sent_log
