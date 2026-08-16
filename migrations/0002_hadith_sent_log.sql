CREATE TABLE hadith (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  week_order INTEGER NOT NULL UNIQUE,
  text_en TEXT NOT NULL,
  text_ar TEXT NOT NULL,
  source_en TEXT NOT NULL,
  source_ar TEXT NOT NULL
);

-- hadith_id is nullable: reminders sent before hadith seed landed have none.
-- week_key (ISO week, e.g. "2026-W33") makes dedup exact without parsing sent_at.
CREATE TABLE sent_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  hadith_id INTEGER REFERENCES hadith(id),
  week_key TEXT NOT NULL,
  sent_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_sent_log_user_week ON sent_log (user_id, week_key);
