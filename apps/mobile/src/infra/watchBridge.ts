/**
 * WatchConnectivity Infrastructure Layer
 *
 * 型付きの送受信ラッパー。ビジネスロジックなし。
 * react-native-watch-connectivity を lazy import で安全にロード。
 *
 * チャネル安全性:
 *   sendMessage         → silent fail (Watch 未インストール/unreachable)
 *   applicationContext   → silent fail (Watch 未インストール)
 *   transferUserInfo     → ネイティブクラッシュ (Watch 未インストール時)
 *                          → getIsWatchAppInstalled() ガード必須
 */
import type { SyncMessage } from "@shoot-creater/core";

type ReplyHandler = ((resp: Record<string, unknown>) => void) | null;
type MessageHandler = (message: SyncMessage, reply: ReplyHandler) => void;
type UnsubscribeFn = () => void;

// ─── Debug Log ───────────────────────────────────────────────

function log(category: string, ...args: unknown[]) {
  if (__DEV__) {
    console.log(`[WSync:${category}]`, ...args);
  }
}

// ─── Lazy Module Loading ──────────────────────────────────────

let _mod: typeof import("react-native-watch-connectivity") | null = null;

async function getModule() {
  if (_mod) return _mod;
  try {
    _mod = await import("react-native-watch-connectivity");
    log("Conn", "module loaded");
    return _mod;
  } catch {
    log("Conn", "module unavailable (not iOS?)");
    return null;
  }
}

// ─── Send ─────────────────────────────────────────────────────

/**
 * transferUserInfo — 確実なキュー配信（アプリ再起動後も届く）
 * ⚠️ Watch 未インストール時にネイティブクラッシュするため
 *    getIsWatchAppInstalled() ガード付き。
 *    iPhone → Watch では使用しない（Watch → iPhone 専用）。
 */
export async function sendReliable(message: SyncMessage): Promise<void> {
  const mod = await getModule();
  if (!mod) return;
  try {
    const installed = await mod.getIsWatchAppInstalled();
    if (!installed) {
      log("Send", "reliable SKIP (watch not installed)", message.type);
      return;
    }
    mod.transferUserInfo(message as unknown as Record<string, unknown>);
    log(
      "Send",
      "reliable →",
      message.type,
      "shotId" in message ? (message as unknown as Record<string, unknown>).shotId : "",
    );
  } catch (e) {
    log("Send", "reliable FAIL", message.type, e);
  }
}

/** sendMessage — リアルタイム配信（到達可能時のみ）。silent fail で安全。 */
export async function sendRealtime(message: SyncMessage): Promise<void> {
  const mod = await getModule();
  if (!mod) return;
  try {
    const reachable = await mod.getReachability();
    if (reachable) {
      mod.sendMessage(message as unknown as Record<string, unknown>);
      log(
        "Send",
        "realtime →",
        message.type,
        "shotId" in message ? (message as unknown as Record<string, unknown>).shotId : "",
      );
    } else {
      log("Send", "realtime SKIP (not reachable)", message.type);
    }
  } catch (e) {
    log("Send", "realtime FAIL", message.type, e);
  }
}

/** updateApplicationContext — 最新状態のみ上書き。silent fail で安全。 */
export async function sendContext(context: Record<string, unknown>): Promise<void> {
  const mod = await getModule();
  if (!mod) return;
  try {
    mod.updateApplicationContext(context);
    log("Send", "context →", Object.keys(context));
  } catch (e) {
    log("Send", "context FAIL", Object.keys(context), e);
  }
}

// ─── Session State ────────────────────────────────────────────

export interface WatchSessionState {
  isPaired: boolean;
  isWatchAppInstalled: boolean;
  isReachable: boolean;
}

/** WCSession の現在の状態を取得（best-effort） */
export async function getSessionState(): Promise<WatchSessionState> {
  const mod = await getModule();
  if (!mod) return { isPaired: false, isWatchAppInstalled: false, isReachable: false };
  try {
    const [isPaired, isWatchAppInstalled, isReachable] = await Promise.all([
      mod.getIsPaired(),
      mod.getIsWatchAppInstalled(),
      mod.getReachability(),
    ]);
    return { isPaired, isWatchAppInstalled, isReachable };
  } catch (e) {
    log("State", "getSessionState FAIL", e);
    return { isPaired: false, isWatchAppInstalled: false, isReachable: false };
  }
}

/** reachability 変更リスナー */
export async function onReachabilityChange(
  handler: (reachable: boolean) => void,
): Promise<UnsubscribeFn> {
  const mod = await getModule();
  if (!mod) return () => {};
  const unsub = mod.watchEvents.on("reachability", (reachable: boolean) => {
    log("Conn", "reachability changed →", reachable);
    handler(reachable);
  });
  return unsub;
}

// ─── Listen ───────────────────────────────────────────────────

/** sendMessage チャネルのリスナー登録 */
export async function onMessage(handler: MessageHandler): Promise<UnsubscribeFn> {
  const mod = await getModule();
  if (!mod) return () => {};
  const unsub = mod.watchEvents.on(
    "message",
    (payload: Record<string, unknown>, reply: unknown) => {
      log("Recv", "message ←", payload?.type, "shotId" in (payload ?? {}) ? payload.shotId : "");
      if (payload && typeof payload.type === "string") {
        handler(
          payload as unknown as SyncMessage,
          typeof reply === "function" ? (reply as ReplyHandler) : null,
        );
      }
    },
  );
  log("Life", "listening on message channel");
  return unsub;
}

/** transferUserInfo チャネルのリスナー登録 */
export async function onUserInfo(handler: MessageHandler): Promise<UnsubscribeFn> {
  const mod = await getModule();
  if (!mod) return () => {};
  const unsub = mod.watchEvents.on("user-info", (payloads: Record<string, unknown>[]) => {
    log(
      "Recv",
      `user-info ← ${payloads.length} item(s)`,
      payloads.map((p) => p.type),
    );
    for (const payload of payloads) {
      if (payload && typeof payload.type === "string") {
        handler(payload as unknown as SyncMessage, null);
      }
    }
  });
  log("Life", "listening on user-info channel");
  return unsub;
}

/** applicationContext チャネルのリスナー登録 */
export async function onApplicationContext(handler: MessageHandler): Promise<UnsubscribeFn> {
  const mod = await getModule();
  if (!mod) return () => {};
  const unsub = mod.watchEvents.on("application-context", (payload: Record<string, unknown>) => {
    log("Recv", "app-context ←", Object.keys(payload ?? {}));
    if (payload && typeof payload.type === "string") {
      handler(payload as unknown as SyncMessage, null);
    }
    // Watch 側の selectedZone 形式もハンドル
    if (payload && typeof payload.selectedZone === "string") {
      handler(
        {
          type: "zone-change",
          zoneId: payload.selectedZone as string,
          timestamp: Date.now(),
        } as SyncMessage,
        null,
      );
    }
  });
  log("Life", "listening on app-context channel");
  return unsub;
}
