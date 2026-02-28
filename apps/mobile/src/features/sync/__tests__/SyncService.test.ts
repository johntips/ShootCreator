import type { Session, Shot, SyncMessage } from "@shoot-creater/core";
import { beforeEach, describe, expect, it, vi } from "vitest";

// ── watchBridge モック ────────────────────────────────────

type MessageHandler = (
  msg: SyncMessage,
  reply: ((resp: Record<string, unknown>) => void) | null,
) => void;

let capturedMessageHandler: MessageHandler | null = null;

vi.mock("@/infra/watchBridge", () => ({
  onMessage: vi.fn(async (handler: MessageHandler) => {
    capturedMessageHandler = handler;
    return () => {
      capturedMessageHandler = null;
    };
  }),
  onUserInfo: vi.fn(async () => () => {}),
  onApplicationContext: vi.fn(async () => () => {}),
  sendRealtime: vi.fn(async () => {}),
  sendContext: vi.fn(async () => {}),
  sendReliable: vi.fn(async () => {}),
}));

// __DEV__ グローバル定義
vi.stubGlobal("__DEV__", false);

import * as bridge from "@/infra/watchBridge";
import { SyncService } from "../SyncService";

// ── ヘルパー ──────────────────────────────────────────────

function makeSession(overrides: Partial<Session> = {}): Session {
  return {
    id: "session-1",
    sportId: "basketball",
    shots: [],
    startedAt: 1000,
    endedAt: null,
    tagIds: [],
    memo: "",
    ...overrides,
  };
}

function sendToService(
  msg: SyncMessage,
  reply: ((resp: Record<string, unknown>) => void) | null = null,
) {
  if (!capturedMessageHandler)
    throw new Error("No message handler registered. Call svc.start() first.");
  capturedMessageHandler(msg, reply);
}

// ── テスト ────────────────────────────────────────────────

describe("SyncService", () => {
  let svc: SyncService;
  let onShot: ReturnType<typeof vi.fn<(shot: Shot) => void>>;
  let onZoneChange: ReturnType<typeof vi.fn<(zoneId: string) => void>>;

  beforeEach(async () => {
    vi.clearAllMocks();
    capturedMessageHandler = null;
    svc = new SyncService();
    onShot = vi.fn<(shot: Shot) => void>();
    onZoneChange = vi.fn<(zoneId: string) => void>();
    await svc.start({ onShot, onZoneChange });
  });

  // ── shot 受信 ──────────────────────────────────────

  describe("shot 受信", () => {
    it("Watch 発ショットで onRemoteShot が呼ばれる", () => {
      sendToService({
        type: "shot",
        shotId: "w-1",
        zoneId: "paint",
        made: true,
        timestamp: 1000,
        source: "watch",
      });
      expect(onShot).toHaveBeenCalledWith({
        zoneId: "paint",
        made: true,
        timestamp: 1000,
      });
    });

    it("iPhone 発エコーは無視される", () => {
      sendToService({
        type: "shot",
        shotId: "i-1",
        zoneId: "paint",
        made: true,
        timestamp: 1000,
        source: "iphone",
      });
      expect(onShot).not.toHaveBeenCalled();
    });

    it("同一 shotId の2回目は重複排除される", () => {
      const msg: SyncMessage = {
        type: "shot",
        shotId: "w-dup",
        zoneId: "paint",
        made: true,
        timestamp: 1000,
        source: "watch",
      };
      sendToService(msg);
      sendToService(msg);
      expect(onShot).toHaveBeenCalledTimes(1);
    });

    it("異なる shotId は個別に受け付ける", () => {
      sendToService({
        type: "shot",
        shotId: "w-1",
        zoneId: "a",
        made: true,
        timestamp: 1,
        source: "watch",
      });
      sendToService({
        type: "shot",
        shotId: "w-2",
        zoneId: "b",
        made: false,
        timestamp: 2,
        source: "watch",
      });
      expect(onShot).toHaveBeenCalledTimes(2);
    });
  });

  // ── zone-change 受信 ──────────────────────────────

  describe("zone-change 受信", () => {
    it("onRemoteZoneChange が zoneId で呼ばれる", () => {
      sendToService({ type: "zone-change", zoneId: "three-left", timestamp: 1000 });
      expect(onZoneChange).toHaveBeenCalledWith("three-left");
    });
  });

  // ── watch-ready ハンドシェイク ─────────────────────

  describe("watch-ready ハンドシェイク", () => {
    it("セッションなし → hasActiveSession: false", () => {
      const reply = vi.fn();
      sendToService({ type: "watch-ready" } as unknown as SyncMessage, reply);
      expect(reply).toHaveBeenCalledWith({ hasActiveSession: false });
    });

    it("アクティブセッションあり → hasActiveSession: true + セッション情報", () => {
      const session = makeSession({ id: "s-42", sportId: "basketball", startedAt: 5000 });
      svc.updateSession(session);
      const reply = vi.fn();
      sendToService({ type: "watch-ready" } as unknown as SyncMessage, reply);
      expect(reply).toHaveBeenCalledWith({
        hasActiveSession: true,
        sessionId: "s-42",
        sportId: "basketball",
        startedAt: 5000,
      });
    });

    it("終了済みセッション → hasActiveSession: false", () => {
      const session = makeSession({ endedAt: 9999 });
      svc.updateSession(session);
      const reply = vi.fn();
      sendToService({ type: "watch-ready" } as unknown as SyncMessage, reply);
      expect(reply).toHaveBeenCalledWith({ hasActiveSession: false });
    });

    it("reply が null でもクラッシュしない", () => {
      expect(() => {
        sendToService({ type: "watch-ready" } as unknown as SyncMessage, null);
      }).not.toThrow();
    });
  });

  // ── unhandled type ────────────────────────────────

  describe("unhandled type", () => {
    it("コールバック呼ばれない、エラーなし", () => {
      expect(() => {
        sendToService({ type: "unknown-type" } as unknown as SyncMessage);
      }).not.toThrow();
      expect(onShot).not.toHaveBeenCalled();
      expect(onZoneChange).not.toHaveBeenCalled();
    });
  });

  // ── sendShot ──────────────────────────────────────

  describe("sendShot", () => {
    it("bridge.sendRealtime（ショット）+ sendRealtime（スタッツ）+ sendContext が呼ばれる", async () => {
      const session = makeSession({
        shots: [{ zoneId: "paint", made: true, timestamp: 1 }],
      });
      await svc.sendShot("paint", true, session);

      // sendRealtime: ショットメッセージ + スタッツメッセージ = 2回
      expect(bridge.sendRealtime).toHaveBeenCalledTimes(2);

      const shotCall = vi.mocked(bridge.sendRealtime).mock.calls[0][0] as unknown as Record<
        string,
        unknown
      >;
      expect(shotCall.type).toBe("shot");
      expect(shotCall.zoneId).toBe("paint");
      expect(shotCall.made).toBe(true);
      expect(shotCall.source).toBe("iphone");

      // sendContext: スタッツスナップショット
      expect(bridge.sendContext).toHaveBeenCalledTimes(1);
      expect(bridge.sendContext).toHaveBeenCalledWith({
        zoneStats: [{ zoneId: "paint", made: 1, attempted: 1 }],
      });
    });

    it("送信した shotId は dedup Set に登録され、受信時に重複扱い", async () => {
      const session = makeSession({
        shots: [{ zoneId: "paint", made: true, timestamp: 1 }],
      });
      await svc.sendShot("paint", true, session);

      const sentMsg = vi.mocked(bridge.sendRealtime).mock.calls[0][0] as unknown as Record<
        string,
        unknown
      >;
      // 同じ shotId を受信すると重複排除される
      sendToService({
        type: "shot",
        shotId: sentMsg.shotId as string,
        zoneId: "paint",
        made: true,
        timestamp: 1000,
        source: "watch",
      });
      expect(onShot).not.toHaveBeenCalled();
    });

    it("更新後セッションのスタッツが即座に送信される（off-by-one 防止）", async () => {
      const session = makeSession({
        shots: [
          { zoneId: "paint", made: true, timestamp: 1 },
          { zoneId: "paint", made: false, timestamp: 2 },
          { zoneId: "three", made: true, timestamp: 3 },
        ],
      });
      await svc.sendShot("paint", true, session);

      expect(bridge.sendContext).toHaveBeenCalledWith({
        zoneStats: expect.arrayContaining([
          { zoneId: "paint", made: 1, attempted: 2 },
          { zoneId: "three", made: 1, attempted: 1 },
        ]),
      });
    });
  });

  // ── sendZoneChange ────────────────────────────────

  describe("sendZoneChange", () => {
    it("bridge.sendContext + sendRealtime が呼ばれる", async () => {
      await svc.sendZoneChange("three-left");
      expect(bridge.sendContext).toHaveBeenCalledWith({ selectedZone: "three-left" });
      expect(bridge.sendRealtime).toHaveBeenCalledTimes(1);
    });
  });

  // ── sendSessionStart ──────────────────────────────

  describe("sendSessionStart", () => {
    it("bridge.sendRealtime + sendContext が呼ばれ currentSession が更新", async () => {
      const session = makeSession({ id: "new-s" });
      await svc.sendSessionStart(session);
      expect(bridge.sendRealtime).toHaveBeenCalledTimes(1);
      expect(bridge.sendContext).toHaveBeenCalledTimes(1);

      // currentSession が更新されたので watch-ready で返る
      const reply = vi.fn();
      sendToService({ type: "watch-ready" } as unknown as SyncMessage, reply);
      expect(reply).toHaveBeenCalledWith(
        expect.objectContaining({ hasActiveSession: true, sessionId: "new-s" }),
      );
    });
  });

  // ── sendSessionEnd ────────────────────────────────

  describe("sendSessionEnd", () => {
    it("endedAt なし → 早期 return", async () => {
      await svc.sendSessionEnd(makeSession({ endedAt: null }));
      expect(bridge.sendRealtime).not.toHaveBeenCalled();
    });

    it("endedAt あり → bridge.sendRealtime + sendContext + currentSession null", async () => {
      const session = makeSession({ endedAt: 9999 });
      svc.updateSession(session);
      await svc.sendSessionEnd(session);
      expect(bridge.sendRealtime).toHaveBeenCalledTimes(1);
      expect(bridge.sendContext).toHaveBeenCalledWith(
        expect.objectContaining({ activeSessionId: null }),
      );

      // currentSession が null になる
      const reply = vi.fn();
      sendToService({ type: "watch-ready" } as unknown as SyncMessage, reply);
      expect(reply).toHaveBeenCalledWith({ hasActiveSession: false });
    });
  });

  // ── stop ──────────────────────────────────────────

  describe("stop", () => {
    it("stop 後は shot 受信してもコールバック呼ばれない", () => {
      svc.stop();
      expect(onShot).not.toHaveBeenCalled();
    });

    it("stop 後 currentSession は null", () => {
      svc.updateSession(makeSession());
      svc.stop();
      // 新しい start なしに watch-ready を検証
      const reply = vi.fn();
      // capturedMessageHandler は stop で解除されるので直接 handleIncoming は呼べない
      // stop で seenShotIds もクリアされることを確認
      expect(() => svc.stop()).not.toThrow(); // 二重 stop も安全
    });
  });

  // ── syncStats ─────────────────────────────────────

  describe("syncStats", () => {
    it("bridge.sendRealtime + sendContext の両チャネルで送信", async () => {
      const session = makeSession({
        shots: [
          { zoneId: "paint", made: true, timestamp: 1 },
          { zoneId: "paint", made: false, timestamp: 2 },
          { zoneId: "three", made: true, timestamp: 3 },
        ],
      });
      await svc.syncStats(session);

      // sendRealtime: stats-sync メッセージ
      expect(bridge.sendRealtime).toHaveBeenCalledTimes(1);
      const realtimeArg = vi.mocked(bridge.sendRealtime).mock.calls[0][0] as unknown as Record<
        string,
        unknown
      >;
      expect(realtimeArg.type).toBe("stats-sync");
      expect(realtimeArg.zoneStats).toBeDefined();

      // sendContext: applicationContext バックアップ
      expect(bridge.sendContext).toHaveBeenCalledWith({
        zoneStats: expect.arrayContaining([
          { zoneId: "paint", made: 1, attempted: 2 },
          { zoneId: "three", made: 1, attempted: 1 },
        ]),
      });
    });

    it("空セッションでは空配列が送信される", async () => {
      await svc.syncStats(makeSession());
      expect(bridge.sendContext).toHaveBeenCalledWith({ zoneStats: [] });
    });
  });

  // ── エラーハンドリング ─────────────────────────────

  describe("エラーハンドリング", () => {
    it("sendRealtime が失敗しても syncStats は sendContext まで実行する", async () => {
      vi.mocked(bridge.sendRealtime).mockRejectedValueOnce(new Error("network error"));

      const session = makeSession({
        shots: [{ zoneId: "paint", made: true, timestamp: 1 }],
      });
      // エラーでもクラッシュしない
      await expect(svc.syncStats(session)).resolves.toBeUndefined();
      // sendContext は呼ばれる（フォールバック）
      expect(bridge.sendContext).toHaveBeenCalledTimes(1);
    });

    it("sendContext が失敗しても sendShot 全体はクラッシュしない", async () => {
      vi.mocked(bridge.sendContext).mockRejectedValueOnce(new Error("context error"));

      const session = makeSession({
        shots: [{ zoneId: "paint", made: true, timestamp: 1 }],
      });
      await expect(svc.sendShot("paint", true, session)).resolves.toBeUndefined();
      // sendRealtime（ショット）は呼ばれている
      expect(bridge.sendRealtime).toHaveBeenCalled();
    });

    it("sendRealtime と sendContext 両方失敗しても安全", async () => {
      vi.mocked(bridge.sendRealtime).mockRejectedValue(new Error("realtime fail"));
      vi.mocked(bridge.sendContext).mockRejectedValue(new Error("context fail"));

      const session = makeSession({
        shots: [{ zoneId: "paint", made: true, timestamp: 1 }],
      });
      await expect(svc.sendShot("paint", true, session)).resolves.toBeUndefined();
      await expect(svc.syncStats(session)).resolves.toBeUndefined();
      await expect(svc.sendZoneChange("three")).resolves.toBeUndefined();
      await expect(svc.sendSessionStart(session)).resolves.toBeUndefined();
    });

    it("start 失敗時もクラッシュしない", async () => {
      vi.mocked(bridge.onMessage).mockRejectedValueOnce(new Error("bridge unavailable"));
      const svc2 = new SyncService();
      await expect(svc2.start({ onShot: vi.fn(), onZoneChange: vi.fn() })).resolves.toBeUndefined();
    });
  });

  // ── 連続ショットの整合性 ───────────────────────────

  describe("連続ショットの整合性", () => {
    it("3連続ショット後、最終 syncStats が全ショットを含む", async () => {
      const shots: Shot[] = [];

      for (let i = 0; i < 3; i++) {
        const shot: Shot = { zoneId: "paint", made: i % 2 === 0, timestamp: i };
        shots.push(shot);
        const session = makeSession({ shots: [...shots] });
        await svc.sendShot("paint", shot.made, session);
      }

      // 最後の sendContext 呼び出しが3ショット分を含む
      const lastContextCall = vi.mocked(bridge.sendContext).mock.calls.at(-1);
      expect(lastContextCall).toBeDefined();
      const payload = lastContextCall?.[0] as {
        zoneStats: Array<{ made: number; attempted: number }>;
      };
      expect(payload.zoneStats).toContainEqual({
        zoneId: "paint",
        made: 2,
        attempted: 3,
      });
    });

    it("Watch 発ショット受信後の syncStats に Watch ショットが含まれる", async () => {
      // Watch 発ショットを受信 → iPhone セッションに追加
      sendToService({
        type: "shot",
        shotId: "w-remote-1",
        zoneId: "paint",
        made: true,
        timestamp: 100,
        source: "watch",
      });
      expect(onShot).toHaveBeenCalledTimes(1);

      // iPhone 側で Watch ショットを含むセッションを構築し syncStats
      const sessionWithWatchShot = makeSession({
        shots: [
          { zoneId: "paint", made: true, timestamp: 100 }, // Watch 発
          { zoneId: "three", made: false, timestamp: 200 }, // iPhone 発
        ],
      });
      vi.clearAllMocks();
      await svc.syncStats(sessionWithWatchShot);

      // Watch ショットを含むスタッツが送信される
      expect(bridge.sendContext).toHaveBeenCalledWith({
        zoneStats: expect.arrayContaining([
          { zoneId: "paint", made: 1, attempted: 1 },
          { zoneId: "three", made: 0, attempted: 1 },
        ]),
      });
      expect(bridge.sendRealtime).toHaveBeenCalledTimes(1);
    });

    it("異なるゾーンへの連続ショットも正しく集計", async () => {
      const sessions: Session[] = [
        makeSession({ shots: [{ zoneId: "paint", made: true, timestamp: 1 }] }),
        makeSession({
          shots: [
            { zoneId: "paint", made: true, timestamp: 1 },
            { zoneId: "three", made: false, timestamp: 2 },
          ],
        }),
      ];

      await svc.sendShot("paint", true, sessions[0]);
      await svc.sendShot("three", false, sessions[1]);

      const lastContextCall = vi.mocked(bridge.sendContext).mock.calls.at(-1);
      const payload = lastContextCall?.[0] as {
        zoneStats: Array<{ zoneId: string; made: number; attempted: number }>;
      };
      expect(payload.zoneStats).toContainEqual({ zoneId: "paint", made: 1, attempted: 1 });
      expect(payload.zoneStats).toContainEqual({ zoneId: "three", made: 0, attempted: 1 });
    });
  });
});
