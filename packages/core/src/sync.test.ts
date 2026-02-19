import { describe, expect, it } from "vitest";
import { createShotId, deriveStatsSyncPayload, isDuplicate, syncShotToShot } from "./sync";
import type { Session, SyncShot } from "./types";

describe("createShotId", () => {
  it("文字列を返す", () => {
    expect(typeof createShotId()).toBe("string");
  });

  it("タイムスタンプ-ランダム文字列のフォーマット", () => {
    const id = createShotId();
    expect(id).toMatch(/^\d+-[a-z0-9]+$/);
  });

  it("連続呼び出しでユニークな ID を生成", () => {
    const ids = new Set(Array.from({ length: 100 }, () => createShotId()));
    expect(ids.size).toBe(100);
  });
});

describe("isDuplicate", () => {
  it("未出の shotId → false を返し Set に登録", () => {
    const seen = new Set<string>();
    expect(isDuplicate("shot-1", seen)).toBe(false);
    expect(seen.has("shot-1")).toBe(true);
  });

  it("既出の shotId → true を返す", () => {
    const seen = new Set<string>(["shot-1"]);
    expect(isDuplicate("shot-1", seen)).toBe(true);
  });

  it("異なる shotId は独立判定", () => {
    const seen = new Set<string>();
    expect(isDuplicate("shot-1", seen)).toBe(false);
    expect(isDuplicate("shot-2", seen)).toBe(false);
    expect(isDuplicate("shot-1", seen)).toBe(true);
  });
});

describe("syncShotToShot", () => {
  it("SyncShot → Shot 変換（shotId, source を除去）", () => {
    const sync: SyncShot = {
      shotId: "abc-123",
      zoneId: "paint",
      made: true,
      timestamp: 1000,
      source: "watch",
    };
    const shot = syncShotToShot(sync);
    expect(shot).toEqual({ zoneId: "paint", made: true, timestamp: 1000 });
    expect("shotId" in shot).toBe(false);
    expect("source" in shot).toBe(false);
  });
});

describe("deriveStatsSyncPayload", () => {
  const baseSession: Session = {
    id: "s1",
    sportId: "basketball",
    shots: [],
    startedAt: 1000,
    endedAt: null,
    tagIds: [],
    memo: "",
  };

  it("空セッション → 空配列", () => {
    expect(deriveStatsSyncPayload(baseSession)).toEqual([]);
  });

  it("単一ゾーンのショット → 正しい made/attempted", () => {
    const session: Session = {
      ...baseSession,
      shots: [
        { zoneId: "paint", made: true, timestamp: 1 },
        { zoneId: "paint", made: false, timestamp: 2 },
        { zoneId: "paint", made: true, timestamp: 3 },
      ],
    };
    const result = deriveStatsSyncPayload(session);
    expect(result).toEqual([{ zoneId: "paint", made: 2, attempted: 3 }]);
  });

  it("複数ゾーンのショット → ゾーン別集計", () => {
    const session: Session = {
      ...baseSession,
      shots: [
        { zoneId: "paint", made: true, timestamp: 1 },
        { zoneId: "three", made: false, timestamp: 2 },
        { zoneId: "paint", made: false, timestamp: 3 },
        { zoneId: "three", made: true, timestamp: 4 },
      ],
    };
    const result = deriveStatsSyncPayload(session);
    expect(result).toHaveLength(2);
    expect(result).toContainEqual({ zoneId: "paint", made: 1, attempted: 2 });
    expect(result).toContainEqual({ zoneId: "three", made: 1, attempted: 2 });
  });

  it("全て miss → made が 0", () => {
    const session: Session = {
      ...baseSession,
      shots: [
        { zoneId: "paint", made: false, timestamp: 1 },
        { zoneId: "paint", made: false, timestamp: 2 },
      ],
    };
    const result = deriveStatsSyncPayload(session);
    expect(result).toEqual([{ zoneId: "paint", made: 0, attempted: 2 }]);
  });
});
