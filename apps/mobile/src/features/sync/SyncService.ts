import * as bridge from "@/infra/watchBridge";
/**
 * Watch <-> iPhone 同期オーケストレーター
 *
 * 責務:
 *   - dedup Set 管理（shotId ベース）
 *   - チャネル選択（sendMessage primary / applicationContext backup）
 *   - 受信メッセージのルーティング
 *   - watch-ready ハンドシェイク（Watch 起動時のセッション状態返信）
 *
 * iPhone → Watch: sendMessage + applicationContext のみ
 *   (transferUserInfo はネイティブクラッシュリスクがあるため不使用)
 */
import type { Session, Shot, SyncMessage } from "@shoot-creater/core";
import { createShotId, deriveStatsSyncPayload, isDuplicate } from "@shoot-creater/core";

type ShotCallback = (shot: Shot) => void;
type ZoneCallback = (zoneId: string) => void;
type ReplyHandler = ((resp: Record<string, unknown>) => void) | null;

function log(category: string, ...args: unknown[]) {
  if (__DEV__) {
    console.log(`[WSync:${category}]`, ...args);
  }
}

export class SyncService {
  private seenShotIds = new Set<string>();
  private unsubscribers: Array<() => void> = [];
  private passiveUnsub: (() => void) | null = null;
  private onRemoteShot: ShotCallback | null = null;
  private onRemoteZoneChange: ZoneCallback | null = null;

  /** 現在のセッション参照 — watch-ready 返信用 */
  private currentSession: Session | null = null;

  /**
   * パッシブリスナー — watch-ready ハンドシェイクのみ応答。
   * アプリ起動時に root layout から呼び出し、セッション画面外でも Watch からの
   * watch-ready に返信できるようにする。
   */
  async initPassiveListener(): Promise<void> {
    if (this.passiveUnsub) return; // 既に起動済み
    try {
      const handler = (msg: SyncMessage, reply: ReplyHandler) => this.handleIncoming(msg, reply);
      this.passiveUnsub = await bridge.onMessage(handler);
      log("Life", "passive listener started (watch-ready only)");
    } catch (e) {
      log("Life", "passive listener FAILED", e);
    }
  }

  /** 同期リスナーを開始（best-effort） */
  async start(callbacks: { onShot: ShotCallback; onZoneChange: ZoneCallback }) {
    this.onRemoteShot = callbacks.onShot;
    this.onRemoteZoneChange = callbacks.onZoneChange;

    try {
      const handler = (msg: SyncMessage, reply: ReplyHandler) => this.handleIncoming(msg, reply);

      const u1 = await bridge.onMessage(handler);
      const u2 = await bridge.onUserInfo(handler);
      const u3 = await bridge.onApplicationContext(handler);

      this.unsubscribers.push(u1, u2, u3);
      log("Life", "SyncService started, 3 channels listening");
    } catch (e) {
      log("Life", "SyncService start FAILED (iPhone-only mode)", e);
    }
  }

  /** 同期リスナーを停止 */
  stop() {
    for (const u of this.unsubscribers) u();
    this.unsubscribers = [];
    this.seenShotIds.clear();
    this.onRemoteShot = null;
    this.onRemoteZoneChange = null;
    this.currentSession = null;
    log("Life", "SyncService stopped");
  }

  /** 現在のセッション参照を更新 */
  updateSession(session: Session) {
    this.currentSession = session;
  }

  /** ローカルショットを Watch に送信 + スタッツ即時同期（best-effort） */
  async sendShot(zoneId: string, made: boolean, updatedSession: Session): Promise<void> {
    const shotId = createShotId();
    this.seenShotIds.add(shotId);
    log("Send", `shot → ${shotId} zone=${zoneId} made=${made}`);

    const msg: SyncMessage = {
      type: "shot",
      shotId,
      zoneId,
      made,
      timestamp: Date.now(),
      source: "iphone",
    };

    // ショットメッセージ + スタッツを同時送信（race condition 防止）
    try {
      await bridge.sendRealtime(msg);
    } catch (e) {
      log("Send", "shot realtime FAIL", e);
    }
    // 更新後のセッションで即座にスタッツ同期
    await this.syncStats(updatedSession);
  }

  /** ゾーン変更を Watch に送信（best-effort） */
  async sendZoneChange(zoneId: string): Promise<void> {
    try {
      log("Send", `zone-change → ${zoneId}`);
      await bridge.sendContext({ selectedZone: zoneId });
      await bridge.sendRealtime({
        type: "zone-change",
        zoneId,
        timestamp: Date.now(),
      });
    } catch (e) {
      log("Send", "zone-change FAIL", e);
    }
  }

  /**
   * 最新スタッツスナップショットを Watch に送信（best-effort）
   * sendMessage（リアルタイム）+ applicationContext（確実配信）の両チャネル
   */
  async syncStats(session: Session): Promise<void> {
    const zones = deriveStatsSyncPayload(session);
    const payload = {
      zoneStats: zones.map((z) => ({
        zoneId: z.zoneId,
        made: z.made,
        attempted: z.attempted,
      })),
    };
    log("Send", `stats → ${zones.length} zones`);

    // sendMessage で即時配信（reachable 時のみ）
    try {
      await bridge.sendRealtime({ type: "stats-sync", ...payload } as unknown as SyncMessage);
    } catch (e) {
      log("Send", "stats realtime FAIL", e);
    }
    // applicationContext で確実配信（バックアップ）
    try {
      await bridge.sendContext(payload);
    } catch (e) {
      log("Send", "stats context FAIL", e);
    }
  }

  /** セッション開始を Watch に通知（best-effort） */
  async sendSessionStart(session: Session): Promise<void> {
    try {
      this.currentSession = session;
      log("Life", `session-start → ${session.id}`);
      const msg: SyncMessage = {
        type: "session-start",
        sessionId: session.id,
        sportId: session.sportId,
        startedAt: session.startedAt,
      };

      await bridge.sendRealtime(msg);
      await bridge.sendContext({
        type: "session-start",
        activeSessionId: session.id,
        sportId: session.sportId,
        startedAt: session.startedAt,
      });
    } catch (e) {
      log("Life", "session-start FAIL", e);
    }
  }

  /** セッション終了を Watch に通知（best-effort） */
  async sendSessionEnd(session: Session): Promise<void> {
    try {
      if (!session.endedAt) return;
      log("Life", `session-end → ${session.id}`);
      const msg: SyncMessage = {
        type: "session-end",
        sessionId: session.id,
        endedAt: session.endedAt,
      };

      await bridge.sendRealtime(msg);
      await bridge.sendContext({
        type: "session-end",
        activeSessionId: null,
      });
      this.currentSession = null;
    } catch (e) {
      log("Life", "session-end FAIL", e);
    }
  }

  // ─── Private ──────────────────────────────────────────────

  private handleIncoming(msg: SyncMessage, reply: ReplyHandler) {
    // watch-ready ハンドシェイク — Watch 起動時にセッション状態を返信
    if (msg.type === ("watch-ready" as string)) {
      const s = this.currentSession;
      const resp =
        s && !s.endedAt
          ? {
              hasActiveSession: true,
              sessionId: s.id,
              sportId: s.sportId,
              startedAt: s.startedAt,
            }
          : { hasActiveSession: false };
      log("Recv", `watch-ready → reply hasActiveSession=${resp.hasActiveSession}`);
      reply?.(resp);
      return;
    }

    switch (msg.type) {
      case "shot": {
        if (msg.source === "iphone") {
          log("Recv", `shot ${msg.shotId} → ECHO (self-origin, ignored)`);
          return;
        }
        if (isDuplicate(msg.shotId, this.seenShotIds)) {
          log("Recv", `shot ${msg.shotId} → DUPLICATE (ignored)`);
          return;
        }
        log("Recv", `shot ${msg.shotId} → ACCEPTED zone=${msg.zoneId} made=${msg.made}`);
        this.onRemoteShot?.({
          zoneId: msg.zoneId,
          made: msg.made,
          timestamp: msg.timestamp,
        });
        break;
      }
      case "zone-change": {
        log("Recv", `zone-change → ${msg.zoneId}`);
        this.onRemoteZoneChange?.(msg.zoneId);
        break;
      }
      default:
        log("Recv", `unhandled type: ${msg.type}`);
    }
  }
}

// ─── Singleton ────────────────────────────────────────────────

let _instance: SyncService | null = null;

export function getSyncService(): SyncService {
  if (!_instance) _instance = new SyncService();
  return _instance;
}
