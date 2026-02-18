/** ゾーングループ大分類 */
export type ZoneGroup = "restricted-area" | "paint" | "mid-range" | "three-point" | "deep";

/** コート/フィールド上のエリア定義 */
export interface Zone {
	id: string;
	label: string;
	/** コートマップ表示用の短縮ラベル */
	shortLabel: string;
	/** ゾーンの大分類 */
	group: ZoneGroup;
	/** SVG path data for rendering on court/field map */
	path: string;
	/** SVG上のラベル表示X座標 */
	labelX: number;
	/** SVG上のラベル表示Y座標 */
	labelY: number;
}

/** スポーツごとの設定 */
export interface SportConfig {
	id: string;
	name: string;
	/** 表示用アイコン名 (SF Symbols / MaterialIcons) */
	icon: string;
	zones: Zone[];
	/** 音声認識で成功/失敗を判定するキーワード */
	voiceCommands: {
		made: string[];
		missed: string[];
	};
}

/** 1回のシュート記録 */
export interface Shot {
	zoneId: string;
	made: boolean;
	timestamp: number;
}

/** 計測セッション */
export interface Session {
	id: string;
	sportId: string;
	shots: Shot[];
	startedAt: number;
	endedAt: number | null;
}

/** Zone別の集計結果 */
export interface ZoneStats {
	zoneId: string;
	made: number;
	attempted: number;
}

/** セッション全体の集計結果 */
export interface TotalStats {
	made: number;
	attempted: number;
}

// ─── Repository Interface (Storage Layer Abstraction) ─────────

/**
 * セッション永続化のインターフェース
 * SQLite / Cloud / AsyncStorage など実装を差し替え可能
 */
export interface SessionRepository {
	/** セッションを保存（新規 or 更新） */
	save(session: Session): Promise<void>;
	/** IDで取得 */
	getById(id: string): Promise<Session | null>;
	/** 全セッション取得（新しい順） */
	getAll(): Promise<Session[]>;
	/** 日付範囲で取得 (timestamp) */
	getByDateRange(from: number, to: number): Promise<Session[]>;
	/** 削除 */
	delete(id: string): Promise<void>;
}
