import { useSessionHistory, useTagStore } from "@/infra/storage";
import { getSport, getTotalStats } from "@shoot-creater/core";
import type { Tag } from "@shoot-creater/core";
import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

function formatDate(ts: number): string {
	const d = new Date(ts);
	const month = d.getMonth() + 1;
	const day = d.getDate();
	const h = d.getHours();
	const m = d.getMinutes().toString().padStart(2, "0");
	return `${month}/${day} ${h}:${m}`;
}

export default function HistoryScreen() {
	const router = useRouter();
	const { sessions, refresh } = useSessionHistory();
	const { tags, getAllIncludingArchived } = useTagStore();
	const [allTags, setAllTags] = useState<Tag[]>([]);

	useFocusEffect(
		useCallback(() => {
			refresh();
			getAllIncludingArchived().then(setAllTags);
		}, [refresh, getAllIncludingArchived]),
	);

	const tagMap = useMemo(() => {
		const map = new Map<string, Tag>();
		for (const t of allTags) map.set(t.id, t);
		for (const t of tags) map.set(t.id, t);
		return map;
	}, [allTags, tags]);

	return (
		<View style={styles.container}>
			<LinearGradient
				colors={["#1a1a3e", "#0a0a1a", "#0d1117"]}
				style={StyleSheet.absoluteFill}
			/>
			<SafeAreaView style={{ flex: 1 }} edges={["top"]}>
			<ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: 90 }]}>
				{sessions.length === 0 ? (
					<View style={styles.empty}>
						<Text style={styles.emptyText}>No sessions yet</Text>
						<Text style={styles.emptyHint}>
							Start a shooting session to see your history
						</Text>
					</View>
				) : (
					sessions.map((s) => {
						const stats = getTotalStats(s);
						const pct =
							stats.attempted > 0
								? Math.round((stats.made / stats.attempted) * 100)
								: null;
						const sportName = getSport(s.sportId)?.name ?? s.sportId;
						const sessionTags = s.tagIds
							.map((id) => tagMap.get(id))
							.filter((t): t is Tag => t != null);
						return (
							<Pressable
								key={s.id}
								style={({ pressed }) => [
									styles.card,
									pressed && styles.cardPressed,
								]}
								onPress={() => router.push(`/summary/${s.id}`)}
							>
								<View style={styles.cardInfo}>
									<View style={styles.cardTopRow}>
										<Text style={styles.cardDate}>{formatDate(s.startedAt)}</Text>
										<View style={styles.sportBadge}>
											<Text style={styles.sportBadgeText}>{sportName}</Text>
										</View>
									</View>
									{sessionTags.length > 0 && (
										<View style={styles.tagRow}>
											{sessionTags.map((tag) => (
												<Text key={tag.id} style={styles.tagText}>
													#{tag.name}
												</Text>
											))}
										</View>
									)}
									{s.memo.length > 0 && (
										<Text style={styles.memoPreview} numberOfLines={1}>
											{s.memo}
										</Text>
									)}
									<Text style={styles.cardShots}>
										{stats.made}/{stats.attempted} shots
									</Text>
								</View>
								<Text style={styles.cardPct}>
									{pct !== null ? `${pct}%` : "\u2014"}
								</Text>
							</Pressable>
						);
					})
				)}
			</ScrollView>
			</SafeAreaView>
		</View>
	);
}

const styles = StyleSheet.create({
	container: { flex: 1, backgroundColor: "#0a0a1a" },
	scroll: { padding: 20, gap: 10, paddingBottom: 100 },
	empty: { alignItems: "center", paddingTop: 60, gap: 8 },
	emptyText: { color: "#555", fontSize: 18, fontWeight: "600" },
	emptyHint: { color: "#444", fontSize: 13 },
	card: {
		backgroundColor: "rgba(255,255,255,0.06)",
		borderRadius: 14,
		borderWidth: 1,
		borderColor: "rgba(255,255,255,0.08)",
		padding: 16,
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
	},
	cardPressed: { opacity: 0.7, transform: [{ scale: 0.98 }] },
	cardInfo: { gap: 3, flex: 1 },
	cardTopRow: { flexDirection: "row", alignItems: "center", gap: 8 },
	cardDate: { color: "#fff", fontSize: 15, fontWeight: "600" },
	sportBadge: {
		backgroundColor: "rgba(59,130,246,0.2)",
		borderRadius: 6,
		paddingHorizontal: 6,
		paddingVertical: 2,
	},
	sportBadgeText: { color: "#3B82F6", fontSize: 10, fontWeight: "700" },
	tagRow: { flexDirection: "row", flexWrap: "wrap", gap: 4 },
	tagText: { color: "#8B5CF6", fontSize: 11, fontWeight: "600" },
	memoPreview: { color: "#666", fontSize: 12, fontStyle: "italic" },
	cardShots: { color: "#888", fontSize: 13 },
	cardPct: {
		color: "#3B82F6",
		fontSize: 22,
		fontWeight: "800",
		fontVariant: ["tabular-nums"],
	},
});
