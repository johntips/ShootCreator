import * as SQLite from "expo-sqlite";

const DB_NAME = "shootcreater.db";

let _db: SQLite.SQLiteDatabase | null = null;

/** Get or create the database instance */
export function getDatabase(): SQLite.SQLiteDatabase {
  if (!_db) {
    _db = SQLite.openDatabaseSync(DB_NAME);
    initSchema(_db);
  }
  return _db;
}

function initSchema(db: SQLite.SQLiteDatabase): void {
  db.execSync(`
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY NOT NULL,
      sport_id TEXT NOT NULL,
      started_at INTEGER NOT NULL,
      ended_at INTEGER,
      shots TEXT NOT NULL DEFAULT '[]'
    );

    CREATE INDEX IF NOT EXISTS idx_sessions_started_at ON sessions(started_at);
    CREATE INDEX IF NOT EXISTS idx_sessions_sport_id ON sessions(sport_id);

    CREATE TABLE IF NOT EXISTS tags (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      archived INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL
    );
  `);

  // マイグレーション: tag_ids, memo カラム追加 (既存DB対応)
  addColumnIfNotExists(db, "sessions", "tag_ids", "TEXT NOT NULL DEFAULT '[]'");
  addColumnIfNotExists(db, "sessions", "memo", "TEXT NOT NULL DEFAULT ''");
}

function addColumnIfNotExists(
  db: SQLite.SQLiteDatabase,
  table: string,
  column: string,
  definition: string,
): void {
  const info = db.getAllSync<{ name: string }>(`PRAGMA table_info(${table})`);
  if (!info.some((col) => col.name === column)) {
    db.runSync(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}
