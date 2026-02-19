import type { Session, SessionRepository, Shot } from "@shoot-creater/core";
import { getDatabase } from "./db";

/** SQLite-backed implementation of SessionRepository */
export class SqliteSessionRepository implements SessionRepository {
	async save(session: Session): Promise<void> {
		const db = getDatabase();
		db.runSync(
			`INSERT OR REPLACE INTO sessions (id, sport_id, started_at, ended_at, shots, tag_ids, memo)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
			session.id,
			session.sportId,
			session.startedAt,
			session.endedAt,
			JSON.stringify(session.shots),
			JSON.stringify(session.tagIds),
			session.memo,
		);
	}

	async getById(id: string): Promise<Session | null> {
		const db = getDatabase();
		const row = db.getFirstSync<SessionRow>(
			"SELECT * FROM sessions WHERE id = ?",
			id,
		);
		return row ? rowToSession(row) : null;
	}

	async getAll(): Promise<Session[]> {
		const db = getDatabase();
		const rows = db.getAllSync<SessionRow>(
			"SELECT * FROM sessions ORDER BY started_at DESC",
		);
		return rows.map(rowToSession);
	}

	async getByDateRange(from: number, to: number): Promise<Session[]> {
		const db = getDatabase();
		const rows = db.getAllSync<SessionRow>(
			"SELECT * FROM sessions WHERE started_at >= ? AND started_at <= ? ORDER BY started_at DESC",
			from,
			to,
		);
		return rows.map(rowToSession);
	}

	async delete(id: string): Promise<void> {
		const db = getDatabase();
		db.runSync("DELETE FROM sessions WHERE id = ?", id);
	}
}

// ─── Row mapping ─────────────────────────────────────────────

interface SessionRow {
	id: string;
	sport_id: string;
	started_at: number;
	ended_at: number | null;
	shots: string;
	tag_ids?: string;
	memo?: string;
}

function rowToSession(row: SessionRow): Session {
	return {
		id: row.id,
		sportId: row.sport_id,
		startedAt: row.started_at,
		endedAt: row.ended_at,
		shots: JSON.parse(row.shots) as Shot[],
		tagIds: row.tag_ids ? JSON.parse(row.tag_ids) as string[] : [],
		memo: row.memo ?? "",
	};
}

// ─── Singleton instance ─────────────────────────────────────

let _instance: SqliteSessionRepository | null = null;

export function getSessionRepository(): SessionRepository {
	if (!_instance) {
		_instance = new SqliteSessionRepository();
	}
	return _instance;
}
