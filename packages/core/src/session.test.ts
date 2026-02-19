import { describe, expect, it } from "vitest";
import {
  addShot,
  createSession,
  endSession,
  getAggregateTotalStats,
  getAggregateZoneStats,
  getGroupStats,
  getTotalStats,
  getZoneStats,
  undoLastShot,
} from "./session";
import type { Session, Shot, SportConfig } from "./types";

// ── ヘルパー ──────────────────────────────────────────────

const shot = (zoneId: string, made: boolean, timestamp = Date.now()): Shot => ({
  zoneId,
  made,
  timestamp,
});

const baseSession: Session = {
  id: "test-session",
  sportId: "basketball",
  shots: [],
  startedAt: 1000,
  endedAt: null,
  tagIds: [],
  memo: "",
};

// ── createSession ─────────────────────────────────────────

describe("createSession", () => {
  it("sportId が設定される", () => {
    const s = createSession("basketball");
    expect(s.sportId).toBe("basketball");
  });

  it("shots が空配列", () => {
    expect(createSession("basketball").shots).toEqual([]);
  });

  it("endedAt が null", () => {
    expect(createSession("basketball").endedAt).toBeNull();
  });

  it("tagIds のデフォルト空配列", () => {
    expect(createSession("basketball").tagIds).toEqual([]);
  });

  it("tagIds 指定時に反映", () => {
    expect(createSession("basketball", ["t1", "t2"]).tagIds).toEqual(["t1", "t2"]);
  });

  it("id がユニーク", () => {
    const a = createSession("basketball");
    const b = createSession("basketball");
    expect(a.id).not.toBe(b.id);
  });

  it("memo が空文字", () => {
    expect(createSession("basketball").memo).toBe("");
  });
});

// ── addShot ───────────────────────────────────────────────

describe("addShot", () => {
  it("ショットが末尾に追加される", () => {
    const s = shot("paint", true, 1);
    const result = addShot(baseSession, s);
    expect(result.shots).toHaveLength(1);
    expect(result.shots[0]).toEqual(s);
  });

  it("元のセッションは不変（immutable）", () => {
    const original = { ...baseSession, shots: [shot("paint", true)] };
    const result = addShot(original, shot("three", false));
    expect(original.shots).toHaveLength(1);
    expect(result.shots).toHaveLength(2);
    expect(result).not.toBe(original);
  });

  it("複数ショット追加で正しい順序", () => {
    let s: Session = baseSession;
    s = addShot(s, shot("a", true, 1));
    s = addShot(s, shot("b", false, 2));
    s = addShot(s, shot("c", true, 3));
    expect(s.shots.map((sh) => sh.zoneId)).toEqual(["a", "b", "c"]);
  });
});

// ── undoLastShot ──────────────────────────────────────────

describe("undoLastShot", () => {
  it("最後のショットが除去される", () => {
    const s: Session = {
      ...baseSession,
      shots: [shot("a", true), shot("b", false)],
    };
    const result = undoLastShot(s);
    expect(result.shots).toHaveLength(1);
    expect(result.shots[0].zoneId).toBe("a");
  });

  it("空 shots でも安全に動作", () => {
    const result = undoLastShot(baseSession);
    expect(result.shots).toEqual([]);
  });

  it("元のセッションは不変", () => {
    const original: Session = {
      ...baseSession,
      shots: [shot("a", true)],
    };
    const result = undoLastShot(original);
    expect(original.shots).toHaveLength(1);
    expect(result.shots).toHaveLength(0);
  });
});

// ── endSession ────────────────────────────────────────────

describe("endSession", () => {
  it("endedAt にタイムスタンプが設定される", () => {
    const before = Date.now();
    const result = endSession(baseSession);
    expect(result.endedAt).toBeGreaterThanOrEqual(before);
    expect(result.endedAt).toBeLessThanOrEqual(Date.now());
  });

  it("元のセッションは不変", () => {
    const result = endSession(baseSession);
    expect(baseSession.endedAt).toBeNull();
    expect(result.endedAt).not.toBeNull();
  });
});

// ── getZoneStats ──────────────────────────────────────────

describe("getZoneStats", () => {
  it("空セッション → 空配列", () => {
    expect(getZoneStats(baseSession)).toEqual([]);
  });

  it("単一ゾーン → made/attempted 集計", () => {
    const s: Session = {
      ...baseSession,
      shots: [shot("paint", true), shot("paint", false), shot("paint", true)],
    };
    const result = getZoneStats(s);
    expect(result).toEqual([{ zoneId: "paint", made: 2, attempted: 3 }]);
  });

  it("複数ゾーン → ゾーン別集計", () => {
    const s: Session = {
      ...baseSession,
      shots: [shot("paint", true), shot("three", false), shot("paint", false)],
    };
    const result = getZoneStats(s);
    expect(result).toHaveLength(2);
    expect(result).toContainEqual({ zoneId: "paint", made: 1, attempted: 2 });
    expect(result).toContainEqual({ zoneId: "three", made: 0, attempted: 1 });
  });
});

// ── getTotalStats ─────────────────────────────────────────

describe("getTotalStats", () => {
  it("空セッション → 0/0", () => {
    expect(getTotalStats(baseSession)).toEqual({ made: 0, attempted: 0 });
  });

  it("全ショットの made/attempted 合計", () => {
    const s: Session = {
      ...baseSession,
      shots: [shot("a", true), shot("b", false), shot("c", true)],
    };
    expect(getTotalStats(s)).toEqual({ made: 2, attempted: 3 });
  });
});

// ── getAggregateZoneStats ─────────────────────────────────

describe("getAggregateZoneStats", () => {
  it("複数セッション横断のゾーン別集計", () => {
    const s1: Session = {
      ...baseSession,
      shots: [shot("paint", true), shot("three", false)],
    };
    const s2: Session = {
      ...baseSession,
      shots: [shot("paint", false), shot("paint", true)],
    };
    const result = getAggregateZoneStats([s1, s2]);
    expect(result).toContainEqual({ zoneId: "paint", made: 2, attempted: 3 });
    expect(result).toContainEqual({ zoneId: "three", made: 0, attempted: 1 });
  });

  it("空セッション配列 → 空配列", () => {
    expect(getAggregateZoneStats([])).toEqual([]);
  });
});

// ── getAggregateTotalStats ────────────────────────────────

describe("getAggregateTotalStats", () => {
  it("複数セッション横断の全体集計", () => {
    const s1: Session = {
      ...baseSession,
      shots: [shot("a", true), shot("b", false)],
    };
    const s2: Session = {
      ...baseSession,
      shots: [shot("c", true)],
    };
    expect(getAggregateTotalStats([s1, s2])).toEqual({ made: 2, attempted: 3 });
  });

  it("空配列 → 0/0", () => {
    expect(getAggregateTotalStats([])).toEqual({ made: 0, attempted: 0 });
  });
});

// ── getGroupStats ─────────────────────────────────────────

describe("getGroupStats", () => {
  const mockSport: SportConfig = {
    id: "test",
    name: "Test",
    icon: "basketball",
    zones: [
      { id: "z1", group: "paint", path: "", label: "Z1", shortLabel: "Z1", labelX: 0, labelY: 0 },
      { id: "z2", group: "paint", path: "", label: "Z2", shortLabel: "Z2", labelX: 0, labelY: 0 },
      {
        id: "z3",
        group: "three-point",
        path: "",
        label: "Z3",
        shortLabel: "Z3",
        labelX: 0,
        labelY: 0,
      },
    ],
    voiceCommands: { made: [], missed: [] },
  };

  it("ゾーンスタッツをグループ別に集計", () => {
    const stats = [
      { zoneId: "z1", made: 3, attempted: 5 },
      { zoneId: "z2", made: 1, attempted: 2 },
      { zoneId: "z3", made: 2, attempted: 4 },
    ];
    const result = getGroupStats(stats, mockSport);
    expect(result).toContainEqual({
      groupId: "paint",
      label: "paint",
      made: 4,
      attempted: 7,
    });
    expect(result).toContainEqual({
      groupId: "three-point",
      label: "three-point",
      made: 2,
      attempted: 4,
    });
  });

  it("ショットのないグループは 0/0", () => {
    const result = getGroupStats([], mockSport);
    expect(result).toContainEqual({
      groupId: "paint",
      label: "paint",
      made: 0,
      attempted: 0,
    });
  });
});
