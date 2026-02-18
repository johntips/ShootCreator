import { CourtMap } from "@/components/CourtMap";
import { ZoneSelector } from "@/components/ZoneSelector";
import { useVoiceCounter } from "@/features/voice/useVoiceCounter";
import { useSessionStore } from "@/infra/storage";
import {
	addShot,
	basketball,
	createSession,
	endSession,
	getSport,
	getTotalStats,
	getZoneStats,
	undoLastShot,
} from "@shoot-creater/core";
import type { Session, Shot } from "@shoot-creater/core";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// ─── Group label mapping ────────────────────────────────────────
const GROUP_LABELS: Record<string, string> = {
	"restricted-area": "INSIDE",
	paint: "PAINT",
	"mid-range": "MID-RANGE",
	"three-point": "3-POINT",
	deep: "DEEP",
};

const GROUP_COLORS: Record<string, string> = {
	"restricted-area": "#E5451F",
	paint: "#F59E0B",
	"mid-range": "#8B5CF6",
	"three-point": "#3B82F6",
	deep: "#EC4899",
};

export default function SessionScreen() {
	const { sport: sportId } = useLocalSearchParams<{ sport: string }>();
	const sportConfig = getSport(sportId ?? "basketball") ?? basketball;
	const { save } = useSessionStore();
	const router = useRouter();
	const insets = useSafeAreaInsets();

	const [session, setSession] = useState<Session>(() => createSession(sportId ?? "basketball"));
	const [selectedZoneId, setSelectedZoneId] = useState(sportConfig?.zones[0]?.id ?? "");

	const zoneStats = useMemo(() => getZoneStats(session), [session]);
	const totalStats = useMemo(() => getTotalStats(session), [session]);

	const handleShot = useCallback(
		(made: boolean) => {
			const shot: Shot = { zoneId: selectedZoneId, made, timestamp: Date.now() };
			setSession((prev) => {
				const next = addShot(prev, shot);
				save(next);
				return next;
			});
		},
		[selectedZoneId, save],
	);

	const handleUndo = useCallback(() => {
		setSession((prev) => {
			if (prev.shots.length === 0) return prev;
			const next = undoLastShot(prev);
			save(next);
			return next;
		});
	}, [save]);

	const handleEnd = useCallback(() => {
		if (session.shots.length === 0) {
			router.back();
			return;
		}
		Alert.alert("End Session", "Save and end this shooting session?", [
			{ text: "Cancel", style: "cancel" },
			{
				text: "End",
				style: "destructive",
				onPress: async () => {
					const ended = endSession(session);
					await save(ended);
					router.replace(`/summary/${ended.id}`);
				},
			},
		]);
	}, [session, save, router]);

	// Voice counter (always called — hooks must not be conditional)
	const voice = useVoiceCounter(sportConfig, handleShot);

	// Selected zone info
	const selectedZone = sportConfig.zones.find((z) => z.id === selectedZoneId);
	const selectedZoneStat = zoneStats.find((s) => s.zoneId === selectedZoneId);
	const zoneMade = selectedZoneStat?.made ?? 0;
	const zoneAttempted = selectedZoneStat?.attempted ?? 0;
	const zonePct = zoneAttempted > 0 ? Math.round((zoneMade / zoneAttempted) * 100) : null;
	const totalPct =
		totalStats.attempted > 0 ? Math.round((totalStats.made / totalStats.attempted) * 100) : null;

	const isBasketball = sportConfig.id === "basketball";
	const groupColor = selectedZone ? (GROUP_COLORS[selectedZone.group] ?? "#666") : "#666";
	const groupLabel = selectedZone ? (GROUP_LABELS[selectedZone.group] ?? "") : "";

	return (
		<>
			<Stack.Screen options={{ title: sportConfig.name, headerShown: false }} />
			<View style={[styles.container, { paddingTop: insets.top }]}>
				{/* ── Header ── */}
				<View style={styles.header}>
					<Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={8}>
						<Text style={styles.backBtnText}>{"‹ Back"}</Text>
					</Pressable>
					<Text style={styles.headerTitle}>{sportConfig.name}</Text>
					{session.shots.length > 0 ? (
						<Pressable onPress={handleEnd} style={styles.endBtn} hitSlop={8}>
							<Text style={styles.endBtnText}>END</Text>
						</Pressable>
					) : (
						<View style={{ width: 44 }} />
					)}
				</View>

				{/* ── Court Map ── */}
				<View style={styles.courtSection}>
					{isBasketball ? (
						<CourtMap
							zones={sportConfig.zones}
							selectedZoneId={selectedZoneId}
							onSelectZone={setSelectedZoneId}
							zoneStats={zoneStats}
						/>
					) : (
						<ZoneSelector
							zones={sportConfig.zones}
							selectedId={selectedZoneId}
							onSelect={setSelectedZoneId}
						/>
					)}
				</View>

				{/* ── Selected Zone Indicator ── */}
				<View style={styles.zoneIndicator}>
					<View style={[styles.groupBadge, { backgroundColor: groupColor }]}>
						<Text style={styles.groupBadgeText}>{groupLabel}</Text>
					</View>
					<Text style={styles.zoneName}>{selectedZone?.label ?? "Select Zone"}</Text>
					<Pressable
						style={[styles.voiceBtn, voice.isListening && styles.voiceBtnActive]}
						onPress={voice.toggle}
					>
						<Text style={styles.voiceBtnText}>{voice.isListening ? "MIC ON" : "MIC"}</Text>
					</Pressable>
				</View>

				{/* ── FG Counter ── */}
				<View style={styles.counterSection}>
					<View style={styles.fgMain}>
						<Text style={styles.fgCount}>
							{zoneMade}
							<Text style={styles.fgSlash}> / </Text>
							{zoneAttempted}
						</Text>
						{zonePct !== null ? (
							<Text style={[styles.fgPct, { color: groupColor }]}>{zonePct}%</Text>
						) : (
							<Text style={styles.fgPctEmpty}>---%</Text>
						)}
					</View>
					<View style={styles.totalRow}>
						<Text style={styles.totalLabel}>Total</Text>
						<Text style={styles.totalValue}>
							{totalStats.made}/{totalStats.attempted}
							{totalPct !== null ? ` (${totalPct}%)` : ""}
						</Text>
						{session.shots.length > 0 && (
							<Pressable onPress={handleUndo} style={styles.undoBtn}>
								<Text style={styles.undoBtnText}>UNDO</Text>
							</Pressable>
						)}
					</View>
				</View>

				{/* ── MADE / MISS Buttons ── */}
				<View style={styles.buttonRow}>
					<Pressable
						style={({ pressed }) => [styles.shotBtn, styles.missBtn, pressed && styles.btnPressed]}
						onPress={() => handleShot(false)}
					>
						<Text style={styles.shotBtnText}>MISS</Text>
					</Pressable>
					<Pressable
						style={({ pressed }) => [styles.shotBtn, styles.madeBtn, pressed && styles.btnPressed]}
						onPress={() => handleShot(true)}
					>
						<Text style={styles.shotBtnText}>MADE</Text>
					</Pressable>
				</View>

				{/* ── Voice feedback (compact) ── */}
				{voice.lastWord && (
					<View style={styles.voiceFeedback}>
						<Text style={styles.voiceFeedbackText}>
							Heard: <Text style={styles.voiceFeedbackWord}>{voice.lastWord}</Text>
						</Text>
					</View>
				)}
			</View>
		</>
	);
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: "#0a0a1a",
	},
	error: { color: "#f55", fontSize: 18, textAlign: "center", marginTop: 40 },

	// Header
	header: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		paddingHorizontal: 16,
		paddingVertical: 8,
	},
	backBtn: {
		paddingRight: 8,
	},
	backBtnText: {
		color: "#3B82F6",
		fontSize: 17,
		fontWeight: "500",
	},
	headerTitle: {
		color: "#fff",
		fontSize: 17,
		fontWeight: "700",
		textAlign: "center",
	},
	endBtn: {
		backgroundColor: "#c0392b",
		paddingVertical: 5,
		paddingHorizontal: 10,
		borderRadius: 8,
		alignItems: "center",
	},
	endBtnText: {
		color: "#fff",
		fontSize: 13,
		fontWeight: "800",
	},

	// Court
	courtSection: {
		paddingHorizontal: 12,
	},

	// Zone indicator
	zoneIndicator: {
		flexDirection: "row",
		alignItems: "center",
		paddingHorizontal: 16,
		paddingVertical: 10,
		gap: 10,
	},
	groupBadge: {
		paddingHorizontal: 8,
		paddingVertical: 3,
		borderRadius: 6,
	},
	groupBadgeText: {
		color: "#fff",
		fontSize: 10,
		fontWeight: "800",
		letterSpacing: 0.5,
	},
	zoneName: {
		color: "#fff",
		fontSize: 17,
		fontWeight: "700",
		flex: 1,
	},
	voiceBtn: {
		paddingHorizontal: 12,
		paddingVertical: 6,
		borderRadius: 8,
		backgroundColor: "#1a1a2e",
		borderWidth: 1,
		borderColor: "#333",
	},
	voiceBtnActive: {
		backgroundColor: "#dc2626",
		borderColor: "#dc2626",
	},
	voiceBtnText: {
		color: "#fff",
		fontSize: 11,
		fontWeight: "700",
	},

	// Counter
	counterSection: {
		alignItems: "center",
		paddingVertical: 4,
		gap: 2,
	},
	fgMain: {
		flexDirection: "row",
		alignItems: "baseline",
		gap: 12,
	},
	fgCount: {
		color: "#fff",
		fontSize: 44,
		fontWeight: "800",
		fontVariant: ["tabular-nums"],
	},
	fgSlash: {
		color: "#555",
		fontSize: 32,
		fontWeight: "400",
	},
	fgPct: {
		fontSize: 28,
		fontWeight: "800",
	},
	fgPctEmpty: {
		fontSize: 28,
		fontWeight: "800",
		color: "#333",
	},
	totalRow: {
		flexDirection: "row",
		alignItems: "center",
		gap: 8,
	},
	totalLabel: {
		color: "#666",
		fontSize: 13,
		fontWeight: "500",
	},
	totalValue: {
		color: "#888",
		fontSize: 13,
		fontWeight: "600",
		fontVariant: ["tabular-nums"],
	},
	undoBtn: {
		paddingHorizontal: 8,
		paddingVertical: 2,
		borderRadius: 4,
		backgroundColor: "#1a1a2e",
	},
	undoBtnText: {
		color: "#888",
		fontSize: 11,
		fontWeight: "700",
	},

	// Buttons
	buttonRow: {
		flexDirection: "row",
		paddingHorizontal: 16,
		gap: 12,
		marginTop: 4,
	},
	shotBtn: {
		flex: 1,
		paddingVertical: 22,
		borderRadius: 16,
		alignItems: "center",
		justifyContent: "center",
	},
	missBtn: {
		backgroundColor: "#c0392b",
	},
	madeBtn: {
		backgroundColor: "#27ae60",
	},
	btnPressed: {
		opacity: 0.7,
		transform: [{ scale: 0.97 }],
	},
	shotBtnText: {
		color: "#fff",
		fontSize: 20,
		fontWeight: "800",
		letterSpacing: 1,
	},

	// Voice feedback
	voiceFeedback: {
		alignItems: "center",
		paddingVertical: 6,
	},
	voiceFeedbackText: {
		color: "#555",
		fontSize: 12,
	},
	voiceFeedbackWord: {
		color: "#aaa",
		fontWeight: "700",
	},
});
