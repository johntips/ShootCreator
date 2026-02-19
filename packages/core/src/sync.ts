import type { Session, Shot, SyncShot, ZoneStats } from "./types";

/** ユニークなショットIDを生成（dedup用） */
export function createShotId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/** shotId が既出かチェックし、未出なら登録。true = 重複 */
export function isDuplicate(shotId: string, seen: Set<string>): boolean {
  if (seen.has(shotId)) return true;
  seen.add(shotId);
  return false;
}

/** SyncShot → 保存用の Shot に変換 */
export function syncShotToShot(s: SyncShot): Shot {
  return { zoneId: s.zoneId, made: s.made, timestamp: s.timestamp };
}

/** Session から Watch へ送信するスタッツペイロードを導出 */
export function deriveStatsSyncPayload(session: Session): ZoneStats[] {
  const map = new Map<string, { made: number; attempted: number }>();
  for (const shot of session.shots) {
    const cur = map.get(shot.zoneId) ?? { made: 0, attempted: 0 };
    cur.attempted += 1;
    if (shot.made) cur.made += 1;
    map.set(shot.zoneId, cur);
  }
  return Array.from(map.entries()).map(([zoneId, s]) => ({
    zoneId,
    made: s.made,
    attempted: s.attempted,
  }));
}
