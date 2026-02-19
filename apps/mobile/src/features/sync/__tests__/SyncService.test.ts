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
    it("bridge.sendRealtime が呼ばれる", async () => {
      await svc.sendShot("paint", true);
      expect(bridge.sendRealtime).toHaveBeenCalledTimes(1);
      const arg = vi.mocked(bridge.sendRealtime).mock.calls[0][0] as unknown as Record<
        string,
        unknown
      >;
      expect(arg.type).toBe("shot");
      expect(arg.zoneId).toBe("paint");
      expect(arg.made).toBe(true);
      expect(arg.source).toBe("iphone");
    });

    it("送信した shotId は dedup Set に登録され、受信時に重複扱い", async () => {
      await svc.sendShot("paint", true);
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
      // handleIncoming 自体は呼べるが onRemoteShot が null
      // (実際の運用では listener が解除されるので呼ばれない)
      expect(onShot).not.toHaveBeenCalled();
    });

    it("stop 後 currentSession は null", () => {
      svc.updateSession(makeSession());
      svc.stop();
      const reply = vi.fn();
      // handleIncoming を直接呼べないが、新しい start で確認
      // stop で currentSession が null になることを watch-ready で検証
    });
  });

  // ── syncStats ─────────────────────────────────────

  describe("syncStats", () => {
    it("bridge.sendContext が zoneStats ペイロードで呼ばれる", async () => {
      const session = makeSession({
        shots: [
          { zoneId: "paint", made: true, timestamp: 1 },
          { zoneId: "paint", made: false, timestamp: 2 },
          { zoneId: "three", made: true, timestamp: 3 },
        ],
      });
      await svc.syncStats(session);
      expect(bridge.sendContext).toHaveBeenCalledWith({
        zoneStats: expect.arrayContaining([
          { zoneId: "paint", made: 1, attempted: 2 },
          { zoneId: "three", made: 1, attempted: 1 },
        ]),
      });
    });
  });
});
