# AGENTS.md — Al-Kahf Bot

Context file for starting work on this project from any fresh session.

## What this is

A Telegram bot that sends personalized Thursday-after-Maghrib reminders to recite Surah al-Kahf, with dynamically generated image cards featuring a rotating hadith on the surah's virtues. Multi-user, multi-language (English/Arabic), warm spiritual tone. Cloudflare Workers + D1.

## Status (as of 2026-08-17)

**All 7 tickets implemented, reviewed, merged to `main`, pushed. Issues #1–#7 closed.**

Repo state: `main` @ `2bd5ed2` on GitHub, 89 tests green, typecheck clean, `wrangler deploy --dry-run` bundles (3MB / 1.17MB gzip).

**Card render bug found + fixed (2026-08-17):** resvg-wasm ignores SVG `@font-face` data URIs — without explicit `font.fontBuffers` the hadith text silently rendered as *nothing* (cards were empty frames; the PNG smoke test only checked bytes). Fixed in `src/image.ts` (embedded font decoded from `src/font.ts` and injected via options); `test/image.test.ts` now decodes the PNG and asserts cream text pixels are present (>5000), so blank renders fail CI. Arabic shaping verified correct: resvg ink widths match harfbuzz-shaped reference within ~5% (ink-extent vs advance-width delta). Rendered cards: `/tmp/card7-en.png`, `/tmp/card7-ar.png`, `/tmp/card4-ar.png`.

### Remaining before real deployment (pick up here)

1. **Hadith audit: DONE (2026-08-17)** — all 10 texts verified against primary sources (sunnah.com, Mustadrak al-Hakim, dorar.net, shamela.ws Targhib). 4 PASS as-is; 6 issues found and fixed: wrong citations (H1 → Musnad Ahmad 27516 + al-Nasa'i; H3 → as-Silsilah as-Sahihah 2651 + Sahih at-Targhib 1473; H4 → Muslim 795 only, quote is not Bukhari's wording; H9 → Darimi 3312 + Bayhaqi 5856), duplicates removed (H8 was a truncated copy of H3) and the weak Ibn Mardawayh entry (da'if per al-Albani) dropped. Final set: **8 authentic hadiths, week_order 0-7 contiguous**; remote D1 updated in place.
2. **Deploy: DONE (Slg-cf001@sylergy.net account)** — D1 `766c58c8-...` migrated + seeded (8 hadiths), worker live at `https://al-kahf-bot.slg-cf001.workers.dev` (cron */10), `TELEGRAM_BOT_TOKEN` secret set, webhook registered (verified via `getWebhookInfo`, 0 pending), bot = @SlgReminder_bot, commands registered. Johany-account test resources deleted. GET on root 500s (`SyntaxError: Unexpected end of JSON input`) — expected: grammy's webhook callback only accepts POST update bodies; Telegram never sends GET. **Remaining: live end-to-end test (user sends /start + /setcity) and first real Thursday tick.**
3. **Cold start / render CPU: measured (2026-08-17)** — first-request after idle ~1.0s (3MB bundle + resvg-wasm init), steady-state 40-110ms per request. The README "<5ms" figure is platform cron scheduling, not worker first-invocation. Render CPU for the card itself: verified locally; the deployed render path gets measured on the first real send.
4. Optional follow-ups from code review (judgement calls, not blocking): user shape declared 4× (`commands/cron/store/index`), `city|country` string encoding in `cron.ts`, `sendReminder` Middle Man in `index.ts`, `dateEn` naming in `window.ts`/`aladhan.ts`.

### Known deviations from SPEC.md (intentional)

- Maghrib window 15 min, not 10 (cron jitter margin) — `REMINDER_WINDOW_MIN` in `src/cron.ts`.
- After-midnight sends for late Maghribs (Thu 23:50 → tick Fri 00:05 still fires) — `EARLY_MORNING_CUTOFF`.
- `users.city` nullable (language-first setup); `sent_log.week_key` column added for exact ISO-week dedup.
- Webhook registered manually, not on deploy.
- **Fixed in review**: Thursday-morning false positive (was modulo-1440 wrap bug — now linear `minutesAfterMaghrib` for the Thursday branch; don't reintroduce).

## Repo

- **GitHub:** https://github.com/m-johany/magrib_reminder-bot
- **Local:** `D:\Projects\al-kahf_bot`
- **Spec:** `SPEC.md` · **Deploy guide:** `README.md` · **Issues:** GitHub Issues (1–7 closed)

## Codebase map

| Path | What |
|------|------|
| `src/index.ts` | grammy bot wiring: commands, webhook fetch handler, scheduled handler, real TickDeps (D1 + Aladhan + resvg) |
| `src/commands.ts` | Command logic (`setCityCommand`, `statusCommand`, language/pause/resume) — deps injected (`UserStore`, `fetchPrayerTimes`) |
| `src/cron.ts` | `runTick` — city dedup, Thursday+window detection, retry-once-30s, hadith rotation, per-user isolation, image cache |
| `src/aladhan.ts` | Aladhan client — `fetchPrayerTimes`, `CityNotFoundError` vs `AladhanError` ("Unable to compute" payload = city not found) |
| `src/window.ts` | Time math — `minutesAfterMaghrib` (linear, same-day), `minutesSinceMaghrib` (midnight-crossing), `formatHHMM`/`formatDateEn` (IANA tz via Intl) |
| `src/week.ts` / `src/rotation.ts` | ISO week key + `week_number % count` rotation |
| `src/messages.ts` | All user-facing text, en + ar variants |
| `src/card.ts` | 1080×1080 SVG card (pattern, matn rtl, translation, source) |
| `src/image.ts` | `renderCardPng` via `@resvg/resvg-wasm` (wasm injected by caller) |
| `src/font.ts` | Noto Naskh Arabic base64 — generated by `node scripts/embed-font.mjs` from `assets/NotoNaskhArabic-Regular.ttf` |
| `src/store.ts` | `d1UserStore` — dynamic upsert (`save`) + `get` |
| `migrations/` | `0001_users.sql`, `0002_hadith_sent_log.sql` (wrangler tagged migrations, tag `v1`) |
| `db/seed.sql` | 8 hadith (week_order 0–7) |
| `test/` | vitest: messages, commands, aladhan (msw), cron (fake deps), window, week, rotation, card, image (resvg render smoke) |

## Dev commands

```bash
npm test                 # vitest, 89 tests
npm run typecheck        # tsc --noEmit
npm run db:migrate:local # apply migrations to local D1 (.wrangler/state)
npm run db:seed:local
npm run dev              # wrangler dev
npm run deploy           # wrangler deploy
```

## Testing seams (pre-agreed, from SPEC.md)

- Unit: rotation logic, time-window logic, city dedup.
- Integration: cron tick + commands with mocked Aladhan (msw) / Telegram at the boundary via injected deps.
- No tests for: visual rendering output, Telegram wire format, deploy pipeline.

## D1 Schema

```sql
CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  telegram_chat_id TEXT UNIQUE NOT NULL,
  city TEXT,               -- nullable: language can be set before city
  country TEXT,
  language TEXT NOT NULL DEFAULT 'en' CHECK(language IN ('en', 'ar')),
  paused INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE hadith (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  week_order INTEGER NOT NULL UNIQUE,   -- 0..N-1, rotation = week_number % count
  text_en TEXT NOT NULL,
  text_ar TEXT NOT NULL,
  source_en TEXT NOT NULL,
  source_ar TEXT NOT NULL
);

CREATE TABLE sent_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  hadith_id INTEGER REFERENCES hadith(id),  -- nullable pre-seed
  week_key TEXT NOT NULL,                  -- ISO week "2026-W33", dedup key
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

## Key design decisions

- **Scheduling:** 10-minute cron. Aladhan retry once after 30s, skip city on double failure.
- **Rotation:** `week_number % hadith_count` — deterministic, global, not per-user.
- **Image:** SVG→PNG in Worker via resvg-wasm. Text-only fallback, never silent.
- **Isolation:** One user's failure never blocks another's send.
- **Tone:** Warm, spiritual, "ﷺ", Islamic greetings, both languages.
- **Hadith source:** Config-curated, seeded via SQL.

## APIs used

- **Aladhan:** `GET https://api.aladhan.com/v1/timingsByCity?city=London&country=UK&method=2` (+ optional `date=DD-MM-YYYY`) — `data.timings.Maghrib`, `data.date.gregorian.weekday.en`, `data.meta.timezone`
- **Telegram Bot API:** Webhook for updates, `sendMessage`, `sendPhoto`, `setMyCommands`
- No auth keys beyond `TELEGRAM_BOT_TOKEN`

## Out of scope

- Admin dashboard / web UI
- Group chat support (DM only initially)
- Hijri calendar integration
- Dynamic hadith API (config-based only)
- Multiple prayer calculation methods (ISNA only)
- Analytics / usage tracking beyond sent_log
