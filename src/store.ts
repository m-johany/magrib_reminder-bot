import type { User, UserStore } from "./commands";

interface DbUserRow {
  telegram_chat_id: string;
  city: string;
  country: string;
  language: string;
  paused: number;
}

function toUser(row: DbUserRow): User {
  return {
    telegram_chat_id: row.telegram_chat_id,
    city: row.city,
    country: row.country,
    language: row.language === "ar" ? "ar" : "en",
    paused: row.paused !== 0,
  };
}

export function d1UserStore(db: D1Database): UserStore {
  return {
    async upsert(chatId, fields) {
      await db
        .prepare(
          `INSERT INTO users (telegram_chat_id, city, country) VALUES (?, ?, ?)
           ON CONFLICT(telegram_chat_id) DO UPDATE SET
             city = excluded.city,
             country = excluded.country,
             updated_at = datetime('now')`
        )
        .bind(chatId, fields.city, fields.country)
        .run();
    },
    async get(chatId) {
      const row = await db
        .prepare("SELECT * FROM users WHERE telegram_chat_id = ?")
        .bind(chatId)
        .first<DbUserRow>();
      return row ? toUser(row) : null;
    },
  };
}
