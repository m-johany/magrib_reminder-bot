CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  telegram_chat_id TEXT UNIQUE NOT NULL,
  city TEXT NOT NULL,
  country TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
