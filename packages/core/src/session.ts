import type { GroupStats, Session, Shot, SportConfig, TotalStats, ZoneStats } from "./types";

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

/** 複数セッションのゾーン別集計 */
export function getAggregateZoneStats(sessions: Session[]): ZoneStats[] {
	const map = new Map<string, ZoneStats>();
	for (const session of sessions) {
		for (const shot of session.shots) {
			const existing = map.get(shot.zoneId) ?? { zoneId: shot.zoneId, made: 0, attempted: 0 };
			map.set(shot.zoneId, {
				...existing,
				made: existing.made + (shot.made ? 1 : 0),
				attempted: existing.attempted + 1,
			});
		}
	}
	return Array.from(map.values());
}

/** 複数セッションの全体集計 */
export function getAggregateTotalStats(sessions: Session[]): TotalStats {
	let made = 0;
	let attempted = 0;
	for (const session of sessions) {
		for (const shot of session.shots) {
			if (shot.made) made++;
			attempted++;
		}
	}
	return { made, attempted };
}

/** ゾーンスタッツをグループ別に集計 */
export function getGroupStats(zoneStats: ZoneStats[], sport: SportConfig): GroupStats[] {
	const groupMap = new Map<string, { label: string; made: number; attempted: number }>();

	for (const zone of sport.zones) {
		if (!groupMap.has(zone.group)) {
			groupMap.set(zone.group, { label: zone.group, made: 0, attempted: 0 });
		}
	}

	for (const stat of zoneStats) {
		const zone = sport.zones.find((z) => z.id === stat.zoneId);
		if (!zone) continue;
		const group = groupMap.get(zone.group);
		if (!group) continue;
		group.made += stat.made;
		group.attempted += stat.attempted;
	}

	return Array.from(groupMap.entries()).map(([groupId, data]) => ({
		groupId,
		label: data.label,
		made: data.made,
		attempted: data.attempted,
	}));
}

/** 新規セッション作成 */
export function createSession(sportId: string, tagIds: string[] = []): Session {
	return {
		id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
		sportId,
		shots: [],
		startedAt: Date.now(),
		endedAt: null,
		tagIds,
		memo: "",
	};
}
