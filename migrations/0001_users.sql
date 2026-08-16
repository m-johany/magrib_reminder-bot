CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  telegram_chat_id TEXT UNIQUE NOT NULL,
  city TEXT,
  country TEXT,
  language TEXT NOT NULL DEFAULT 'en' CHECK(language IN ('en', 'ar')),
  paused INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
