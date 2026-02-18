import type { Session, Shot, TotalStats, ZoneStats } from "./types";

/** セッションにショットを追加（immutable） */
export function addShot(session: Session, shot: Shot): Session {
	return { ...session, shots: [...session.shots, shot] };
}

/** 直前のショットを取り消し（immutable） */
export function undoLastShot(session: Session): Session {
	return { ...session, shots: session.shots.slice(0, -1) };
}

/** セッションを終了 */
export function endSession(session: Session): Session {
	return { ...session, endedAt: Date.now() };
}

/** Zone別の集計 */
export function getZoneStats(session: Session): ZoneStats[] {
	const map = new Map<string, ZoneStats>();
	for (const shot of session.shots) {
		const existing = map.get(shot.zoneId) ?? { zoneId: shot.zoneId, made: 0, attempted: 0 };
		map.set(shot.zoneId, {
			...existing,
			made: existing.made + (shot.made ? 1 : 0),
			attempted: existing.attempted + 1,
		});
	}
	return Array.from(map.values());
}

/** セッション全体の集計 */
export function getTotalStats(session: Session): TotalStats {
	let made = 0;
	for (const shot of session.shots) {
		if (shot.made) made++;
	}
	return { made, attempted: session.shots.length };
}

/** 新規セッション作成 */
export function createSession(sportId: string): Session {
	return {
		id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
		sportId,
		shots: [],
		startedAt: Date.now(),
		endedAt: null,
	};
}
