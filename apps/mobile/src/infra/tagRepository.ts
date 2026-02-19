import type { Tag, TagRepository } from "@shoot-creater/core";
import { getDatabase } from "./db";

export class SqliteTagRepository implements TagRepository {
	async save(tag: Tag): Promise<void> {
		const db = getDatabase();
		db.runSync(
			`INSERT OR REPLACE INTO tags (id, name, archived, created_at)
       VALUES (?, ?, ?, ?)`,
			tag.id,
			tag.name,
			tag.archived ? 1 : 0,
			tag.createdAt,
		);
	}

	async getAll(): Promise<Tag[]> {
		const db = getDatabase();
		const rows = db.getAllSync<TagRow>(
			"SELECT * FROM tags ORDER BY created_at DESC",
		);
		return rows.map(rowToTag);
	}

	async getActive(): Promise<Tag[]> {
		const db = getDatabase();
		const rows = db.getAllSync<TagRow>(
			"SELECT * FROM tags WHERE archived = 0 ORDER BY created_at DESC",
		);
		return rows.map(rowToTag);
	}

	async archive(id: string): Promise<void> {
		const db = getDatabase();
		db.runSync("UPDATE tags SET archived = 1 WHERE id = ?", id);
	}

	async rename(id: string, name: string): Promise<void> {
		const db = getDatabase();
		db.runSync("UPDATE tags SET name = ? WHERE id = ?", name, id);
	}
}

interface TagRow {
	id: string;
	name: string;
	archived: number;
	created_at: number;
}

function rowToTag(row: TagRow): Tag {
	return {
		id: row.id,
		name: row.name,
		archived: row.archived === 1,
		createdAt: row.created_at,
	};
}

let _instance: SqliteTagRepository | null = null;

export function getTagRepository(): TagRepository {
	if (!_instance) {
		_instance = new SqliteTagRepository();
	}
	return _instance;
}
