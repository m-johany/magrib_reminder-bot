import type { User, UserPatch, UserStore } from "./commands";

interface DbUserRow {
  telegram_chat_id: string;
  city: string | null;
  country: string | null;
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
  async function save(chatId: string, fields: UserPatch): Promise<void> {
    // Build a dynamic upsert over only the provided fields.
    const keys = Object.keys(fields) as (keyof UserPatch)[];
    const columns = keys.join(", ");
    const placeholders = keys.map(() => "?").join(", ");
    const updates = keys
      .map((k) => `${k} = excluded.${k}`)
      .join(", ");
    await db
      .prepare(
        `INSERT INTO users (telegram_chat_id, ${columns}) VALUES (?, ${placeholders})
         ON CONFLICT(telegram_chat_id) DO UPDATE SET ${updates}, updated_at = datetime('now')`
      )
      .bind(chatId, ...keys.map((k) => fields[k] as string | number))
      .run();
  }

  return {
    save,
    async get(chatId) {
      const row = await db
        .prepare("SELECT * FROM users WHERE telegram_chat_id = ?")
        .bind(chatId)
        .first<DbUserRow>();
      return row ? toUser(row) : null;
    },
  };
}
