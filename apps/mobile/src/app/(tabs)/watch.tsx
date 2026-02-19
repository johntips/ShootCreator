import { LinearGradient } from "expo-linear-gradient";
import { useCallback, useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
	getSessionState,
	onReachabilityChange,
	type WatchSessionState,
} from "@/infra/watchBridge";

const POLL_INTERVAL = 5000;

export default function WatchScreen() {
	const [state, setState] = useState<WatchSessionState>({
		isPaired: false,
		isWatchAppInstalled: false,
		isReachable: false,
	});
	const [polling, setPolling] = useState(false);
	const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

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
		}).then((u) => {
			unsub = u;
		});
		return () => unsub?.();
	}, []);

	return (
		<View style={styles.container}>
			<LinearGradient
				colors={["#1a1a3e", "#0a0a1a", "#0d1117"]}
				style={StyleSheet.absoluteFill}
			/>
			<SafeAreaView style={{ flex: 1 }} edges={["top"]}>
				<View style={styles.content}>
					<Text style={styles.title}>Watch</Text>
					<Text style={styles.subtitle}>Connection Status</Text>

					{/* メインステータス */}
					<View style={styles.statusCard}>
						<View style={styles.statusMain}>
							<View
								style={[
									styles.statusDot,
									state.isReachable
										? styles.dotConnected
										: styles.dotDisconnected,
								]}
							/>
							<Text style={styles.statusText}>
								{state.isReachable ? "接続中" : "未接続"}
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
						style={({ pressed }) => [
							styles.button,
							pressed && styles.buttonPressed,
						]}
						onPress={() => {
							setPolling(true);
							void refresh().finally(() => setPolling(false));
						}}
						disabled={polling}
					>
						<Text style={styles.buttonText}>
							{polling ? "更新中..." : "手動更新"}
						</Text>
					</Pressable>
				</View>
			</SafeAreaView>
		</View>
	);
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
});
