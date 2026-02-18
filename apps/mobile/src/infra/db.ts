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
  `);
}
