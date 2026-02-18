import type { Shot, ZoneStats } from "@shoot-creater/core";

/**
 * WatchConnectivity bridge
 * 初期実装はスタブ。react-native-watch-connectivity を prebuild 後に有効化。
 */

/** Watch側に最新のZone統計を送信 */
export async function syncStatsToWatch(_stats: ZoneStats[]): Promise<void> {
  try {
    const { updateApplicationContext } = await import("react-native-watch-connectivity");
    await updateApplicationContext({ stats: JSON.stringify(_stats) });
  } catch {
    // Watch connectivity not available (simulator, etc.)
  }
}

/** Watch側からのショット通知をリッスン */
export function onWatchShot(_callback: (shot: Shot) => void): () => void {
  let unsubscribe: (() => void) | undefined;

  import("react-native-watch-connectivity")
    .then(({ watchEvents }) => {
      unsubscribe = watchEvents.on("message", (message: Record<string, unknown>) => {
        if (message.type === "shot") {
          _callback(message.shot as Shot);
        }
      });
    })
    .catch(() => {
      // Watch connectivity not available
    });

  return () => unsubscribe?.();
}
