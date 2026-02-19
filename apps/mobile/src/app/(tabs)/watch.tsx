import {
  type WatchSessionState,
  getSessionState,
  onApplicationContext,
  onMessage,
  onReachabilityChange,
  onUserInfo,
} from "@/infra/watchBridge";
import type { SyncMessage } from "@shoot-creater/core";
import { LinearGradient } from "expo-linear-gradient";
import { useCallback, useEffect, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const POLL_INTERVAL = 5000;
const MAX_LOG_ENTRIES = 50;

interface LogEntry {
  id: number;
  time: string;
  channel: string;
  direction: "recv" | "event";
  detail: string;
}

let logId = 0;

function timeStr(): string {
  const d = new Date();
  return `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}:${d.getSeconds().toString().padStart(2, "0")}`;
}

export default function WatchScreen() {
  const [state, setState] = useState<WatchSessionState>({
    isPaired: false,
    isWatchAppInstalled: false,
    isReachable: false,
  });
  const [polling, setPolling] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const logScrollRef = useRef<ScrollView>(null);

  const addLog = useCallback((channel: string, direction: "recv" | "event", detail: string) => {
    setLogs((prev) => {
      const entry: LogEntry = { id: ++logId, time: timeStr(), channel, direction, detail };
      const next = [...prev, entry];
      return next.length > MAX_LOG_ENTRIES ? next.slice(-MAX_LOG_ENTRIES) : next;
    });
    setTimeout(() => logScrollRef.current?.scrollToEnd({ animated: true }), 100);
  }, []);

  const refresh = useCallback(async () => {
    const s = await getSessionState();
    setState(s);
  }, []);

  // 初回取得 + ポーリング
  useEffect(() => {
    void refresh();
    timerRef.current = setInterval(() => void refresh(), POLL_INTERVAL);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [refresh]);

  // reachability リアルタイム更新
  useEffect(() => {
    let unsub: (() => void) | null = null;
    void onReachabilityChange((reachable) => {
      setState((prev) => ({ ...prev, isReachable: reachable }));
      addLog("conn", "event", reachable ? "reachable" : "unreachable");
    }).then((u) => {
      unsub = u;
    });
    return () => unsub?.();
  }, [addLog]);

  // メッセージチャネル監視
  useEffect(() => {
    const unsubs: (() => void)[] = [];

    void onMessage((msg: SyncMessage) => {
      const detail = formatMsg(msg);
      addLog("message", "recv", detail);
    }).then((u) => unsubs.push(u));

    void onUserInfo((msg: SyncMessage) => {
      const detail = formatMsg(msg);
      addLog("userInfo", "recv", detail);
    }).then((u) => unsubs.push(u));

    void onApplicationContext((msg: SyncMessage) => {
      const detail = formatMsg(msg);
      addLog("appCtx", "recv", detail);
    }).then((u) => unsubs.push(u));

    addLog("conn", "event", "listeners registered");

    return () => {
      for (const u of unsubs) u();
    };
  }, [addLog]);

  return (
    <View style={styles.container}>
      <LinearGradient colors={["#1a1a3e", "#0a0a1a", "#0d1117"]} style={StyleSheet.absoluteFill} />
      <SafeAreaView style={{ flex: 1 }} edges={["top"]}>
        <ScrollView contentContainerStyle={[styles.content, { paddingBottom: 90 }]}>
          <Text style={styles.title}>Watch</Text>
          <Text style={styles.subtitle}>Connection Status</Text>

          {/* メインステータス */}
          <View style={styles.statusCard}>
            <View style={styles.statusMain}>
              <View
                style={[
                  styles.statusDot,
                  state.isReachable ? styles.dotConnected : styles.dotDisconnected,
                ]}
              />
              <Text style={styles.statusText}>
                {state.isReachable ? "Connected" : "Disconnected"}
              </Text>
            </View>
          </View>

          {/* WCSession 詳細 */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>WCSession</Text>
            <StatusRow label="Paired" value={state.isPaired} />
            <StatusRow label="Installed" value={state.isWatchAppInstalled} />
            <StatusRow label="Reachable" value={state.isReachable} />
          </View>

          {/* 更新ボタン */}
          <Pressable
            style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
            onPress={() => {
              setPolling(true);
              void refresh().finally(() => setPolling(false));
            }}
            disabled={polling}
          >
            <Text style={styles.buttonText}>{polling ? "Refreshing..." : "Refresh"}</Text>
          </Pressable>

          {/* リアルタイムログ */}
          <View style={styles.logSection}>
            <View style={styles.logHeader}>
              <Text style={styles.logTitle}>Sync Log</Text>
              {logs.length > 0 && (
                <Pressable onPress={() => setLogs([])}>
                  <Text style={styles.logClear}>Clear</Text>
                </Pressable>
              )}
            </View>
            <View style={styles.logCard}>
              <ScrollView ref={logScrollRef} style={styles.logScroll} nestedScrollEnabled>
                {logs.length === 0 ? (
                  <Text style={styles.logEmpty}>Waiting for events...</Text>
                ) : (
                  logs.map((entry) => (
                    <View key={entry.id} style={styles.logRow}>
                      <Text style={styles.logTime}>{entry.time}</Text>
                      <Text
                        style={[
                          styles.logChannel,
                          entry.direction === "event" ? styles.logEvent : styles.logRecv,
                        ]}
                      >
                        {entry.channel}
                      </Text>
                      <Text style={styles.logDetail} numberOfLines={1}>
                        {entry.detail}
                      </Text>
                    </View>
                  ))
                )}
              </ScrollView>
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

function formatMsg(msg: SyncMessage): string {
  const m = msg as unknown as Record<string, unknown>;
  const type = m.type ?? "?";
  const parts = [String(type)];
  if (m.shotId) parts.push(`id:${String(m.shotId).slice(0, 8)}`);
  if (m.zoneId) parts.push(String(m.zoneId));
  if (m.source) parts.push(`from:${String(m.source)}`);
  if (m.made !== undefined) parts.push(m.made ? "MADE" : "MISS");
  if (m.sessionId) parts.push(`s:${String(m.sessionId).slice(0, 8)}`);
  return parts.join(" ");
}

function StatusRow({ label, value }: { label: string; value: boolean }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={[styles.rowValue, value ? styles.rowYes : styles.rowNo]}>
        {value ? "YES" : "NO"}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0a0a1a" },
  content: { paddingHorizontal: 24, gap: 16 },
  title: {
    color: "#fff",
    fontSize: 32,
    fontWeight: "800",
    letterSpacing: -0.5,
  },
  subtitle: {
    color: "#888",
    fontSize: 15,
    fontWeight: "500",
    marginBottom: 4,
  },
  statusCard: {
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    padding: 24,
    alignItems: "center",
  },
  statusMain: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  statusDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
  },
  dotConnected: { backgroundColor: "#34C759" },
  dotDisconnected: { backgroundColor: "#FF3B30" },
  statusText: {
    color: "#fff",
    fontSize: 22,
    fontWeight: "700",
  },
  card: {
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    padding: 16,
    gap: 10,
  },
  cardTitle: {
    color: "#888",
    fontSize: 13,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  rowLabel: { color: "#aaa", fontSize: 15 },
  rowValue: { fontSize: 15, fontWeight: "600" },
  rowYes: { color: "#34C759" },
  rowNo: { color: "#FF3B30" },
  button: {
    backgroundColor: "rgba(0,122,255,0.2)",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(0,122,255,0.3)",
    padding: 14,
    alignItems: "center",
  },
  buttonPressed: { opacity: 0.7 },
  buttonText: {
    color: "#007AFF",
    fontSize: 16,
    fontWeight: "600",
  },
  // ログセクション
  logSection: { gap: 8 },
  logHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  logTitle: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "700",
  },
  logClear: {
    color: "#666",
    fontSize: 13,
    fontWeight: "500",
  },
  logCard: {
    backgroundColor: "rgba(0,0,0,0.4)",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
    overflow: "hidden",
  },
  logScroll: {
    maxHeight: 260,
    padding: 12,
  },
  logEmpty: {
    color: "#555",
    fontSize: 12,
    fontFamily: "Courier",
    textAlign: "center",
    paddingVertical: 20,
  },
  logRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 3,
  },
  logTime: {
    color: "#555",
    fontSize: 11,
    fontFamily: "Courier",
    fontVariant: ["tabular-nums"],
  },
  logChannel: {
    fontSize: 10,
    fontWeight: "700",
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 3,
    overflow: "hidden",
  },
  logRecv: {
    color: "#34C759",
    backgroundColor: "rgba(52,199,89,0.15)",
  },
  logEvent: {
    color: "#FF9F0A",
    backgroundColor: "rgba(255,159,10,0.15)",
  },
  logDetail: {
    color: "#aaa",
    fontSize: 11,
    fontFamily: "Courier",
    flex: 1,
  },
});
