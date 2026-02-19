import { getTagRepository } from "@/infra/tagRepository";
import type { Tag } from "@shoot-creater/core";
import { LinearGradient } from "expo-linear-gradient";
import { Stack, useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
	Alert,
	Pressable,
	ScrollView,
	StyleSheet,
	Text,
	TextInput,
	View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function TagsScreen() {
	const router = useRouter();
	const insets = useSafeAreaInsets();
	const [tags, setTags] = useState<Tag[]>([]);
	const [editingId, setEditingId] = useState<string | null>(null);
	const [editName, setEditName] = useState("");

	const loadTags = useCallback(async () => {
		const all = await getTagRepository().getAll();
		setTags(all);
	}, []);

	useEffect(() => {
		loadTags();
	}, [loadTags]);

	const activeTags = tags.filter((t) => !t.archived);
	const archivedTags = tags.filter((t) => t.archived);

	const handleRename = useCallback(
		async (id: string) => {
			const name = editName.trim();
			if (!name) return;
			await getTagRepository().rename(id, name);
			setEditingId(null);
			setEditName("");
			loadTags();
		},
		[editName, loadTags],
	);

	const handleArchive = useCallback(
		(tag: Tag) => {
			Alert.alert("Archive Tag", `Archive "#${tag.name}"?`, [
				{ text: "Cancel", style: "cancel" },
				{
					text: "Archive",
					style: "destructive",
					onPress: async () => {
						await getTagRepository().archive(tag.id);
						loadTags();
					},
				},
			]);
		},
		[loadTags],
	);

	return (
		<>
			<Stack.Screen options={{ title: "Tags", headerShown: false }} />
			<View style={[styles.container, { paddingTop: insets.top }]}>
				<LinearGradient
					colors={["#1a1a3e", "#0a0a1a", "#0d1117"]}
					style={StyleSheet.absoluteFill}
				/>
				<View style={styles.header}>
					<Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={8}>
						<Text style={styles.backBtnText}>{"‹ Back"}</Text>
					</Pressable>
					<Text style={styles.headerTitle}>Tags</Text>
					<View style={{ width: 60 }} />
				</View>
				<ScrollView contentContainerStyle={styles.scroll}>
					{activeTags.length === 0 && archivedTags.length === 0 && (
						<View style={styles.empty}>
							<Text style={styles.emptyText}>No tags yet</Text>
							<Text style={styles.emptyHint}>
								Create tags during a session to organize your practice
							</Text>
						</View>
					)}

					{activeTags.length > 0 && (
						<>
							<Text style={styles.sectionLabel}>Active Tags</Text>
							{activeTags.map((tag) => (
								<View key={tag.id} style={styles.tagCard}>
									{editingId === tag.id ? (
										<View style={styles.editRow}>
											<TextInput
												style={styles.editInput}
												value={editName}
												onChangeText={setEditName}
												autoFocus
												onSubmitEditing={() => handleRename(tag.id)}
												returnKeyType="done"
											/>
											<Pressable
												style={styles.editSaveBtn}
												onPress={() => handleRename(tag.id)}
											>
												<Text style={styles.editSaveBtnText}>Save</Text>
											</Pressable>
											<Pressable
												onPress={() => {
													setEditingId(null);
													setEditName("");
												}}
											>
												<Text style={styles.cancelText}>Cancel</Text>
											</Pressable>
										</View>
									) : (
										<View style={styles.tagRow}>
											<Text style={styles.tagName}>#{tag.name}</Text>
											<View style={styles.tagActions}>
												<Pressable
													onPress={() => {
														setEditingId(tag.id);
														setEditName(tag.name);
													}}
													style={styles.actionBtn}
												>
													<Text style={styles.actionBtnText}>Edit</Text>
												</Pressable>
												<Pressable
													onPress={() => handleArchive(tag)}
													style={styles.actionBtn}
												>
													<Text style={styles.archiveBtnText}>Archive</Text>
												</Pressable>
											</View>
										</View>
									)}
								</View>
							))}
						</>
					)}

					{archivedTags.length > 0 && (
						<>
							<Text style={[styles.sectionLabel, { marginTop: 24 }]}>Archived</Text>
							{archivedTags.map((tag) => (
								<View key={tag.id} style={[styles.tagCard, styles.tagCardArchived]}>
									<Text style={styles.tagNameArchived}>#{tag.name}</Text>
									<Text style={styles.archivedBadge}>archived</Text>
								</View>
							))}
						</>
					)}
				</ScrollView>
			</View>
		</>
	);
}

const styles = StyleSheet.create({
	container: { flex: 1, backgroundColor: "#0a0a1a" },
	header: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		paddingHorizontal: 16,
		paddingVertical: 8,
	},
	backBtn: {
		backgroundColor: "rgba(255,255,255,0.06)",
		borderRadius: 10,
		borderWidth: 1,
		borderColor: "rgba(255,255,255,0.08)",
		paddingHorizontal: 12,
		paddingVertical: 6,
	},
	backBtnText: { color: "#3B82F6", fontSize: 15, fontWeight: "600" },
	headerTitle: { color: "#fff", fontSize: 17, fontWeight: "700" },
	scroll: { padding: 20, paddingBottom: 40, gap: 8 },
	empty: { alignItems: "center", paddingTop: 60, gap: 8 },
	emptyText: { color: "#555", fontSize: 18, fontWeight: "600" },
	emptyHint: { color: "#444", fontSize: 13, textAlign: "center" },
	sectionLabel: {
		color: "#888",
		fontSize: 12,
		fontWeight: "600",
		textTransform: "uppercase",
		letterSpacing: 0.5,
		marginBottom: 4,
	},
	tagCard: {
		backgroundColor: "rgba(255,255,255,0.06)",
		borderRadius: 12,
		borderWidth: 1,
		borderColor: "rgba(255,255,255,0.08)",
		padding: 14,
	},
	tagCardArchived: { opacity: 0.5 },
	tagRow: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
	},
	tagName: { color: "#fff", fontSize: 15, fontWeight: "600", flex: 1 },
	tagNameArchived: { color: "#666", fontSize: 15, fontWeight: "600" },
	archivedBadge: { color: "#555", fontSize: 11, marginTop: 4 },
	tagActions: { flexDirection: "row", gap: 8 },
	actionBtn: {
		backgroundColor: "rgba(255,255,255,0.06)",
		borderRadius: 8,
		paddingHorizontal: 10,
		paddingVertical: 5,
	},
	actionBtnText: { color: "#888", fontSize: 12, fontWeight: "600" },
	archiveBtnText: { color: "#ef4444", fontSize: 12, fontWeight: "600" },
	editRow: { flexDirection: "row", alignItems: "center", gap: 8 },
	editInput: {
		flex: 1,
		color: "#fff",
		fontSize: 14,
		backgroundColor: "rgba(255,255,255,0.06)",
		borderRadius: 8,
		paddingHorizontal: 10,
		paddingVertical: 6,
	},
	editSaveBtn: {
		backgroundColor: "rgba(59,130,246,0.2)",
		borderRadius: 8,
		paddingHorizontal: 12,
		paddingVertical: 6,
	},
	editSaveBtnText: { color: "#3B82F6", fontSize: 13, fontWeight: "600" },
	cancelText: { color: "#666", fontSize: 12, fontWeight: "600" },
});
