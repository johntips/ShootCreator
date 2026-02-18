import { useSessionHistory } from "@/infra/storage";
import { getAllSports, getTotalStats } from "@shoot-creater/core";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

function formatDate(ts: number): string {
	const d = new Date(ts);
	const month = d.getMonth() + 1;
	const day = d.getDate();
	const h = d.getHours();
	const m = d.getMinutes().toString().padStart(2, "0");
	return `${month}/${day} ${h}:${m}`;
}

export default function HomeScreen() {
	const router = useRouter();
	const sportList = getAllSports();
	const { sessions, refresh } = useSessionHistory();

	useFocusEffect(
		useCallback(() => {
			refresh();
		}, [refresh]),
	);

	return (
		<ScrollView style={styles.scroll} contentContainerStyle={styles.container}>
			<Text style={styles.title}>Select Sport</Text>
			{sportList.map((sport) => {
				const isReady = sport.zones[0]?.path !== "";
				return (
					<Pressable
						key={sport.id}
						style={[styles.card, !isReady && styles.cardDisabled]}
						onPress={() => isReady && router.push(`/session/${sport.id}`)}
						disabled={!isReady}
					>
						<Text style={styles.cardText}>{sport.name}</Text>
						{!isReady && <Text style={styles.badge}>Coming Soon</Text>}
					</Pressable>
				);
			})}

			{sessions.length > 0 && (
				<>
					<Text style={styles.sectionTitle}>Recent Sessions</Text>
					{sessions.slice(0, 10).map((s) => {
						const stats = getTotalStats(s);
						const pct =
							stats.attempted > 0
								? Math.round((stats.made / stats.attempted) * 100)
								: null;
						return (
							<Pressable
								key={s.id}
								style={styles.sessionCard}
								onPress={() => router.push(`/summary/${s.id}`)}
							>
								<View style={styles.sessionInfo}>
									<Text style={styles.sessionDate}>{formatDate(s.startedAt)}</Text>
									<Text style={styles.sessionShots}>
										{stats.made}/{stats.attempted} shots
									</Text>
								</View>
								<Text style={styles.sessionPct}>
									{pct !== null ? `${pct}%` : "\u2014"}
								</Text>
							</Pressable>
						);
					})}
				</>
			)}
		</ScrollView>
	);
}

const styles = StyleSheet.create({
	scroll: { flex: 1 },
	container: { padding: 24, gap: 16, paddingBottom: 40 },
	title: { color: "#fff", fontSize: 28, fontWeight: "700", marginBottom: 8 },
	card: {
		backgroundColor: "#1a1a2e",
		borderRadius: 16,
		padding: 20,
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
	},
	cardDisabled: { opacity: 0.4 },
	cardText: { color: "#fff", fontSize: 20, fontWeight: "600" },
	badge: { color: "#888", fontSize: 12 },
	sectionTitle: {
		color: "#fff",
		fontSize: 20,
		fontWeight: "700",
		marginTop: 16,
	},
	sessionCard: {
		backgroundColor: "#1a1a2e",
		borderRadius: 12,
		padding: 16,
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
	},
	sessionInfo: {
		gap: 2,
	},
	sessionDate: {
		color: "#fff",
		fontSize: 15,
		fontWeight: "600",
	},
	sessionShots: {
		color: "#888",
		fontSize: 13,
	},
	sessionPct: {
		color: "#3B82F6",
		fontSize: 22,
		fontWeight: "800",
		fontVariant: ["tabular-nums"],
	},
});
