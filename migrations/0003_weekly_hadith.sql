CREATE TABLE IF NOT EXISTS weekly_hadith (
  week_key TEXT PRIMARY KEY,
  hadith_key TEXT NOT NULL,
  text_en TEXT NOT NULL,
  text_ar TEXT NOT NULL,
  source_en TEXT NOT NULL,
  source_ar TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_weekly_hadith_created ON weekly_hadith (created_at DESC);
