# Al-Kahf Bot — Specification

A Telegram bot that sends personalized Thursday-after-Maghrib reminders to recite Surah al-Kahf, with dynamically generated images featuring a rotating hadith on the surah's virtues.

## Problem Statement

The previous Al-Kahf reminder bot is defunct. Users who relied on it to remember reciting Surah al-Kahf on Fridays (which begins Thursday after Maghrib) have no automated reminder. The new bot must handle per-user timezone-aware Maghrib calculation, present hadith on the surah's virtues with a rotating weekly cycle, and produce visually fitting imagery — all without manual upkeep.

## Solution

A multi-user Telegram bot running on Cloudflare Workers. Each user sets their city and preferred language. A Cron Trigger runs every 10 minutes, fetches Maghrib times from the Aladhan API for each user's city, and sends a reminder when Maghrib has just passed on a Thursday. Each reminder includes a dynamically generated image card with the week's rotating hadith virtue rendered over an Islamic/natural template background. The bot speaks in a warm, spiritual tone and supports both English and Arabic.

## User Stories

### Core Flow
1. As a user, I want to add the bot on Telegram and receive a welcome message explaining its purpose, so that I understand what the bot does.
2. As a user, I want to set my city so that the bot sends reminders at the correct Maghrib time for my location.
3. As a user, I want to choose English or Arabic as my preferred language, so that I receive reminders in a language I understand.
4. As a user, I want to receive a reminder every Thursday after my local Maghrib time, so that I remember to recite Surah al-Kahf.
5. As a user, I want each reminder to include an image with a hadith about the virtues of Surah al-Kahf, so that I am motivated by the authentic teachings.
6. As a user, I want the hadith virtue to rotate each week, so that I learn different virtues over time.
7. As a user, I want the image to have an Islamic or natural aesthetic, so that it befits the sacred content.

### Settings & Control
8. As a user, I want to change my city later, so that the bot stays accurate when I move or travel.
9. As a user, I want to change my language preference later, so that I can switch between English and Arabic.
10. As a user, I want to pause reminders temporarily, so that I am not disturbed during travel or unusual schedules.
11. As a user, I want to resume reminders after pausing, so that I don't miss future reminders.
12. As a user, I want to check my current settings (city, language, reminder status), so that I can confirm they are correct.

### Discoverability
13. As a user, I want a help command listing all available commands, so that I can discover functionality without memorizing them.
14. As a new user, I want the start command to guide me through setup (city + language), so that I am not confused about what to do first.

### Reliability
15. As a user, I want the bot to handle unknown or misspelled cities gracefully with a helpful error message, so that I can correct my input.
16. As a user, I want the bot to work even when Aladhan API is slow or temporarily unavailable, so that I don't miss a reminder due to a transient error.

## Implementation Decisions

### Architecture
- **Platform:** Cloudflare Workers, deployed via Wrangler.
- **Language:** TypeScript with `@cloudflare/workers-types`.
- **Database:** Cloudflare D1 (SQLite). Schema:
  - `users` table: `id` (PK), `telegram_chat_id` (unique), `city`, `country`, `language` (`'en'` | `'ar'`), `paused` (boolean), `created_at`, `updated_at`.
  - `hadith` table: `id` (PK), `week_number` (integer), `text_en`, `text_ar`, `source_en`, `source_ar`.
  - `sent_log` table: `id` (PK), `user_id` (FK), `hadith_id` (FK), `sent_at`.
- **Scheduling:** Cloudflare Workers Cron Trigger, every 10 minutes. On each tick: query D1 for unpaused users, fetch Maghrib for each unique city (cached per tick), identify users whose Maghrib just passed on a Thursday, generate + send reminders.
- **Telegram integration:** Webhook mode. Worker registers webhook with Telegram on deploy. Handles updates from Telegram for commands.

### Prayer Times
- **API:** Aladhan API (`api.aladhan.com`), free tier, no authentication.
- **Endpoint:** `/timingsByCity?city=London&country=UK&method=2` (ISNA method default, configurable per-city later if needed).
- **Caching:** Per 10-minute tick, deduplicate city lookups. Store timestamp of lookup so duplicate cities in same tick hit cache, not the API.
- **Thursday detection:** Server-side. After fetching timings, check `DateObject.gregorian.weekday.en` === "Thursday" from the Aladhan response. Only send if both conditions hold: Maghrib just passed AND today is Thursday.

### Image Generation
- **Approach:** Single static Islamic/natural template background image. Hadith text overlaid dynamically at send time.
- **Rendering:** SVG composed programmatically, converted to PNG via `@resvg/resvg-wasm` in the Worker. Arabic text rendered with appropriate font (e.g., Noto Naskh Arabic) bundled as a base64 font in the Worker.
- **Template design:** Calm natural motif (floral/geometric Islamic pattern or nature landscape), muted warm tones. Arabic text prominently with English below. Source citation in small text at bottom.
- **Dimensions:** 1080×1080 (square, Telegram-optimized).

### Bot Commands & Interaction
Bot responds to the following commands. Commands are registered via Telegram's `setMyCommands` API.

| Command | Behavior |
|---------|----------|
| `/start` | Welcome message with bot purpose, prompt to set city + language. |
| `/setcity <city>, <country>` | Store user's city/country. Validates against Aladhan. On failure, asks user to retry. |
| `/setlanguage` | Inline keyboard: "English" / "العربية". Stores preference. |
| `/pause` | Sets `paused = true`. Confirms with message. |
| `/resume` | Sets `paused = false`. Confirms with message. |
| `/status` | Replies with current city, language, and paused state. |
| `/help` | Lists all commands with brief descriptions. |

### Hadith Rotation
- **Rotation logic:** Weekly cycle. The active hadith for a given ISO week number = `week_number % total_hadith_count`. This deterministically maps each week to a hadith, rotating through all entries.
- **Seed data:** 10-20 curated authentic hadith on Surah al-Kahf virtues. Each entry has Arabic text, English translation, and source reference. Stored in the `hadith` table, populated via a seed SQL file.
- **Future extensibility:** The `hadith` table schema supports adding new entries or swapping to an API-backed source later. The rotation logic is agnostic to data origin.

### Tone & Language
- **English messages:** Warm, spiritual tone. Uses "ﷺ" after mentioning the Prophet. Opens with Islamic greetings (As-salamu alaykum) where appropriate.
- **Arabic messages:** Matching warm spiritual tone, with appropriate Islamic phrasing.
- **Hadith images:** Always show both Arabic text (original hadith) and the user's chosen language for translation. If user chose Arabic, Arabic-only card is acceptable with the matn (text) being the primary content.

### Error Handling
- **Aladhan API failure:** Retry once after 30s. If still failing, skip that tick. Log error. Next tick (10 min later) retries.
- **Invalid city:** Aladhan returns error → bot replies: "I couldn't find that city. Please try again with format: `/setcity London, UK`".
- **Telegram API failure:** Log error. Send failure for one user does not block others.
- **Image generation failure:** Fallback to text-only reminder message with the hadith in plain text.

## Testing Decisions

- **What makes a good test:** Test external behavior only — given a user with city X, when the cron fires at a Thursday Maghrib time, the bot sends a message. Mock Aladhan and Telegram APIs at the boundary. Never test internal Worker plumbing.
- **Integration tests:** Use `wrangler dev` with a local D1 binding. Mock Aladhan responses via `undici` MockAgent or `msw`. Assert the bot calls Telegram's `sendPhoto` with correct chat ID, image, and caption.
- **Unit tests:**
  - Rotation logic: given week numbers and hadith counts, assert correct index.
  - Time window logic: given a Maghrib timestamp and current timestamp, assert whether reminder should fire.
  - City deduplication: given multiple users in same city, assert one API call.
- **No tests for:** Template rendering output (visual regression), Telegram Bot API wire format (tested by their SDK/server), Worker deployment pipeline.

## Out of Scope

- Admin dashboard or web UI.
- Analytics or usage tracking beyond the `sent_log` table.
- User-facing hadith management interface — hadith are seeded via SQL and manageably curated by the maintainer.
- Group chat support — direct messages only for initial release.
- Multiple calculation methods (Hanafi vs. standard) — ISNA method only. Can parameterize later.
- Push notifications outside Telegram.
- Dynamic hadith API integration — designed for but not built now.
- Payment or donation features.
- Multi-language beyond English and Arabic.

## Further Notes

- **Hadith authenticity:** All hadith in the seed data must be verified authentic (sahih or hasan) from recognized collections (Bukhari, Muslim, Tirmidhi, Abu Dawud, etc.). Include full reference chain in source fields.
- **Islamic date consideration:** The bot uses Gregorian calendar (Thursday detection). Hijri calendar integration is out of scope but the Aladhan API returns Hijri date data if needed later.
- **Deployment flow:** `wrangler deploy` from local machine. Set Telegram bot token as Worker secret (`wrangler secret put TELEGRAM_BOT_TOKEN`). D1 database created via `wrangler d1 create al-kahf-db`. Seed with `wrangler d1 execute al-kahf-db --file=./db/seed.sql`.
- **Cold start:** Workers cold-start in <5ms for scheduled triggers. No warm-up needed.
- **Free tier fit:** ~8,640 cron invocations/month + negligible D1 reads. Well within Cloudflare free tier. Aladhan API is free with no rate limits (reasonable use).
