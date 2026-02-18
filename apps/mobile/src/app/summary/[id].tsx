import { CourtMap } from "@/components/CourtMap";
import { getSessionRepository } from "@/infra/sessionRepository";
import {
	basketball,
	getSport,
	getTotalStats,
	getZoneStats,
} from "@shoot-creater/core";
import type { Session } from "@shoot-creater/core";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

function formatTime(ts: number): string {
	const d = new Date(ts);
	return `${d.getHours()}:${d.getMinutes().toString().padStart(2, "0")}`;
}

function formatDate(ts: number): string {
	const d = new Date(ts);
	return `${d.getMonth() + 1}/${d.getDate()} ${formatTime(ts)}`;
}

export default function SummaryScreen() {
	const { id } = useLocalSearchParams<{ id: string }>();
	const router = useRouter();
	const [session, setSession] = useState<Session | null>(null);

	useEffect(() => {
		getSessionRepository()
			.getById(id ?? "")
			.then(setSession);
	}, [id]);

	if (!session) {
		return (
			<View style={styles.container}>
				<Text style={styles.loading}>Loading...</Text>
			</View>
		);
	}

	const sportConfig = getSport(session.sportId) ?? basketball;
	const totalStats = getTotalStats(session);
	const zoneStats = getZoneStats(session);
	const fgPct =
		totalStats.attempted > 0
			? Math.round((totalStats.made / totalStats.attempted) * 100)
			: 0;

	const dateStr = session.endedAt
		? `${formatDate(session.startedAt)} - ${formatTime(session.endedAt)}`
		: formatDate(session.startedAt);

	const zoneBreakdown = zoneStats
		.map((s) => {
			const zone = sportConfig.zones.find((z) => z.id === s.zoneId);
			return {
				...s,
				label: zone?.label ?? s.zoneId,
				pct: Math.round((s.made / s.attempted) * 100),
			};
		})
		.sort((a, b) => b.attempted - a.attempted);

	return (
		<>
			<Stack.Screen options={{ title: "Summary" }} />
			<ScrollView style={styles.container} contentContainerStyle={styles.content}>
				<Text style={styles.title}>Session Complete</Text>
				<Text style={styles.dateText}>{dateStr}</Text>

				{/* Overall FG */}
				<View style={styles.fgCard}>
					<Text style={styles.fgCount}>
						{totalStats.made} / {totalStats.attempted}
					</Text>
					<Text style={styles.fgPct}>{fgPct}%</Text>
					<Text style={styles.fgLabel}>Field Goal</Text>
				</View>

				{/* Court Heatmap */}
				<View style={styles.courtSection}>
					<CourtMap
						zones={sportConfig.zones}
						selectedZoneId=""
						onSelectZone={() => {}}
						zoneStats={zoneStats}
					/>
				</View>

				{/* Zone Breakdown */}
				{zoneBreakdown.length > 0 && (
					<View style={styles.breakdownSection}>
						<Text style={styles.sectionTitle}>Zone Breakdown</Text>
						{zoneBreakdown.map((z) => (
							<View key={z.zoneId} style={styles.breakdownRow}>
								<Text style={styles.breakdownLabel} numberOfLines={1}>
									{z.label}
								</Text>
								<Text style={styles.breakdownValue}>
									{z.made}/{z.attempted}
								</Text>
								<Text style={styles.breakdownPct}>{z.pct}%</Text>
							</View>
						))}
					</View>
				)}

				{/* Action Buttons */}
				<View style={styles.actions}>
					<Pressable
						style={[styles.actionBtn, styles.newBtn]}
						onPress={() => router.replace(`/session/${session.sportId}`)}
					>
						<Text style={styles.actionBtnText}>New Session</Text>
					</Pressable>
					<Pressable
						style={[styles.actionBtn, styles.homeBtn]}
						onPress={() => router.replace("/")}
					>
						<Text style={styles.actionBtnText}>Home</Text>
					</Pressable>
				</View>
			</ScrollView>
		</>
	);
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: "#0a0a1a",
	},
	content: {
		padding: 20,
		paddingBottom: 40,
	},
	loading: {
		color: "#888",
		fontSize: 16,
		textAlign: "center",
		marginTop: 40,
	},
	title: {
		color: "#fff",
		fontSize: 24,
		fontWeight: "800",
		textAlign: "center",
	},
	dateText: {
		color: "#888",
		fontSize: 14,
		textAlign: "center",
		marginTop: 4,
		marginBottom: 20,
	},
	fgCard: {
		backgroundColor: "#1a1a2e",
		borderRadius: 16,
		padding: 24,
		alignItems: "center",
		marginBottom: 20,
	},
	fgCount: {
		color: "#fff",
		fontSize: 40,
		fontWeight: "800",
		fontVariant: ["tabular-nums"],
	},
	fgPct: {
		color: "#3B82F6",
		fontSize: 32,
		fontWeight: "800",
		marginTop: 4,
	},
	fgLabel: {
		color: "#666",
		fontSize: 13,
		fontWeight: "500",
		marginTop: 4,
	},
	courtSection: {
		marginBottom: 20,
	},
	breakdownSection: {
		marginBottom: 24,
	},
	sectionTitle: {
		color: "#fff",
		fontSize: 17,
		fontWeight: "700",
		marginBottom: 12,
	},
	breakdownRow: {
		flexDirection: "row",
		alignItems: "center",
		paddingVertical: 8,
		borderBottomWidth: StyleSheet.hairlineWidth,
		borderBottomColor: "#222",
	},
	breakdownLabel: {
		flex: 1,
		color: "#ccc",
		fontSize: 14,
		fontWeight: "500",
	},
	breakdownValue: {
		color: "#fff",
		fontSize: 14,
		fontWeight: "700",
		fontVariant: ["tabular-nums"],
		width: 60,
		textAlign: "right",
	},
	breakdownPct: {
		color: "#3B82F6",
		fontSize: 14,
		fontWeight: "700",
		width: 48,
		textAlign: "right",
	},
	actions: {
		flexDirection: "row",
		gap: 12,
	},
	actionBtn: {
		flex: 1,
		paddingVertical: 16,
		borderRadius: 12,
		alignItems: "center",
	},
	newBtn: {
		backgroundColor: "#27ae60",
	},
	homeBtn: {
		backgroundColor: "#1a1a2e",
		borderWidth: 1,
		borderColor: "#333",
	},
	actionBtnText: {
		color: "#fff",
		fontSize: 16,
		fontWeight: "700",
	},
});
