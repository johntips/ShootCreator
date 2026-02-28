import { CourtMap } from "@/components/CourtMap";
import { ZoneSelector } from "@/components/ZoneSelector";
import { useWatchSync } from "@/features/sync/useWatchSync";
import { useVoiceCounter } from "@/features/voice/useVoiceCounter";
import { useSessionStore, useTagStore } from "@/infra/storage";
import {
  playMadeFeedback,
  playMissFeedback,
  preloadShotSounds,
  unloadShotSounds,
} from "@/utils/shotFeedback";
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
import type { Session, Shot, Tag } from "@shoot-creater/core";
import { LinearGradient } from "expo-linear-gradient";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
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
  const { tags, createTag } = useTagStore();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [session, setSession] = useState<Session>(() => createSession(sportId ?? "basketball"));
  const [selectedZoneId, setSelectedZoneId] = useState(sportConfig?.zones[0]?.id ?? "");
  const [showTagPicker, setShowTagPicker] = useState(false);
  const [newTagName, setNewTagName] = useState("");
  const memoRef = useRef(session.memo);

  // サウンドのプリロード/アンロード
  useEffect(() => {
    void preloadShotSounds();
    return () => {
      void unloadShotSounds();
    };
  }, []);

  const zoneStats = useMemo(() => getZoneStats(session), [session]);
  const totalStats = useMemo(() => getTotalStats(session), [session]);

  const selectedTagObjects = useMemo(
    () => tags.filter((t) => session.tagIds.includes(t.id)),
    [tags, session.tagIds],
  );

  // ─── Watch 双方向同期 ────────────────────────────────────
  // syncStatsRef: handleRemoteShot → watchSync の循環参照を避けるための ref
  // biome-ignore lint/style/noNonNullAssertion: watchSync 初期化後に即座に設定
  const syncStatsRef = useRef<(s: Session) => void>(null!);

  const handleRemoteShot = useCallback(
    (shot: Shot) => {
      let updatedSession: Session | undefined;
      setSession((prev) => {
        const next = addShot(prev, shot);
        save(next);
        updatedSession = next;
        return next;
      });
      if (updatedSession) {
        syncStatsRef.current(updatedSession);
      }
    },
    [save],
  );

  const handleRemoteZoneChange = useCallback((zoneId: string) => {
    setSelectedZoneId(zoneId);
  }, []);

  const watchSync = useWatchSync({
    session,
    onRemoteShot: handleRemoteShot,
    onRemoteZoneChange: handleRemoteZoneChange,
  });
  syncStatsRef.current = watchSync.syncStats;

  /** ユーザー操作でゾーン変更 → Watch にも同期 */
  const handleZoneChange = useCallback(
    (zoneId: string) => {
      setSelectedZoneId(zoneId);
      watchSync.sendZoneChange(zoneId);
    },
    [watchSync],
  );

  // ─── Shot / Undo / End ───────────────────────────────────
  const handleShot = useCallback(
    (made: boolean) => {
      const shot: Shot = { zoneId: selectedZoneId, made, timestamp: Date.now() };
      let updatedSession: Session | undefined;
      setSession((prev) => {
        const next = addShot(prev, shot);
        save(next);
        updatedSession = next;
        return next;
      });
      // updatedSession は setSession のアップデータ内で同期的に設定済み
      if (updatedSession) {
        watchSync.sendShot(selectedZoneId, made, updatedSession);
      }
      if (made) {
        playMadeFeedback();
      } else {
        playMissFeedback();
      }
    },
    [selectedZoneId, save, watchSync],
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
          watchSync.sendSessionEnd(ended);
          router.replace(`/summary/${ended.id}`);
        },
      },
    ]);
  }, [session, save, router, watchSync]);

  const toggleTag = useCallback(
    (tagId: string) => {
      setSession((prev) => {
        const has = prev.tagIds.includes(tagId);
        const next = {
          ...prev,
          tagIds: has ? prev.tagIds.filter((id) => id !== tagId) : [...prev.tagIds, tagId],
        };
        save(next);
        return next;
      });
    },
    [save],
  );

  const handleCreateTag = useCallback(async () => {
    const name = newTagName.trim();
    if (!name) return;
    const tag = await createTag(name);
    setNewTagName("");
    toggleTag(tag.id);
    setShowTagPicker(false);
  }, [newTagName, createTag, toggleTag]);

  const handleMemoChange = useCallback(
    (text: string) => {
      memoRef.current = text;
      setSession((prev) => {
        const next = { ...prev, memo: text };
        save(next);
        return next;
      });
    },
    [save],
  );

  // Voice counter
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
      <KeyboardAvoidingView
        style={[styles.container, { paddingTop: insets.top }]}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <LinearGradient
          colors={["#1a1a3e", "#0a0a1a", "#0d1117"]}
          style={StyleSheet.absoluteFill}
        />
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* ── Header ── */}
          <View style={styles.header}>
            <Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={8}>
              <Text style={styles.backBtnText}>{"‹ Back"}</Text>
            </Pressable>
            <Text style={styles.headerTitle}>{sportConfig.name}</Text>
            {session.shots.length > 0 ? (
              <Pressable
                testID="btn-end-session"
                onPress={handleEnd}
                style={styles.endBtn}
                hitSlop={8}
              >
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
                onSelectZone={handleZoneChange}
                zoneStats={zoneStats}
              />
            ) : (
              <ZoneSelector
                zones={sportConfig.zones}
                selectedId={selectedZoneId}
                onSelect={handleZoneChange}
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
              testID="btn-mic"
              style={[styles.voiceBtn, voice.isListening && styles.voiceBtnActive]}
              onPress={voice.toggle}
            >
              <Text style={styles.voiceBtnText}>{voice.isListening ? "MIC ON" : "MIC"}</Text>
            </Pressable>
          </View>

          {/* ── FG Counter ── */}
          <View style={styles.counterSection}>
            <View style={styles.fgMain}>
              <Text testID="zone-made-count" style={styles.fgCount}>
                {zoneMade}
                <Text style={styles.fgSlash}> / </Text>
                <Text testID="zone-attempted-count">{zoneAttempted}</Text>
              </Text>
              {zonePct !== null ? (
                <Text testID="zone-pct" style={[styles.fgPct, { color: groupColor }]}>
                  {zonePct}%
                </Text>
              ) : (
                <Text testID="zone-pct" style={styles.fgPctEmpty}>
                  ---%
                </Text>
              )}
            </View>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Total</Text>
              <Text testID="total-stats" style={styles.totalValue}>
                {totalStats.made}/{totalStats.attempted}
                {totalPct !== null ? ` (${totalPct}%)` : ""}
              </Text>
              {session.shots.length > 0 && (
                <Pressable testID="btn-undo" onPress={handleUndo} style={styles.undoBtn}>
                  <Text style={styles.undoBtnText}>UNDO</Text>
                </Pressable>
              )}
            </View>
          </View>

          {/* ── MADE / MISS Buttons ── */}
          <View style={styles.buttonRow}>
            <Pressable
              testID="btn-miss"
              style={({ pressed }) => [
                styles.shotBtn,
                styles.missBtn,
                pressed && styles.btnPressed,
              ]}
              onPress={() => handleShot(false)}
            >
              <Text style={styles.shotBtnText}>MISS</Text>
            </Pressable>
            <Pressable
              testID="btn-made"
              style={({ pressed }) => [
                styles.shotBtn,
                styles.madeBtn,
                pressed && styles.btnPressed,
              ]}
              onPress={() => handleShot(true)}
            >
              <Text style={styles.shotBtnText}>MADE</Text>
            </Pressable>
          </View>

          {/* ── Voice feedback ── */}
          {voice.lastWord && (
            <View style={styles.voiceFeedback}>
              <Text style={styles.voiceFeedbackText}>
                Heard: <Text style={styles.voiceFeedbackWord}>{voice.lastWord}</Text>
              </Text>
            </View>
          )}

          {/* ── Tags ── */}
          <View style={styles.tagsSection}>
            <Text style={styles.sectionLabel}>Tags</Text>
            <View style={styles.tagChipRow}>
              {selectedTagObjects.map((tag) => (
                <Pressable key={tag.id} style={styles.tagChip} onPress={() => toggleTag(tag.id)}>
                  <Text style={styles.tagChipText}>#{tag.name}</Text>
                  <Text style={styles.tagChipRemove}> ×</Text>
                </Pressable>
              ))}
              <Pressable style={styles.tagAddBtn} onPress={() => setShowTagPicker(!showTagPicker)}>
                <Text style={styles.tagAddBtnText}>+ Add</Text>
              </Pressable>
            </View>

            {showTagPicker && (
              <View style={styles.tagPicker}>
                <View style={styles.tagInputRow}>
                  <TextInput
                    style={styles.tagInput}
                    placeholder="New tag..."
                    placeholderTextColor="#555"
                    value={newTagName}
                    onChangeText={setNewTagName}
                    onSubmitEditing={handleCreateTag}
                    returnKeyType="done"
                  />
                  {newTagName.trim().length > 0 && (
                    <Pressable style={styles.tagCreateBtn} onPress={handleCreateTag}>
                      <Text style={styles.tagCreateBtnText}>Create</Text>
                    </Pressable>
                  )}
                </View>
                {tags
                  .filter((t) => !session.tagIds.includes(t.id))
                  .map((tag) => (
                    <Pressable
                      key={tag.id}
                      style={styles.tagPickerItem}
                      onPress={() => {
                        toggleTag(tag.id);
                        setShowTagPicker(false);
                      }}
                    >
                      <Text style={styles.tagPickerItemText}>#{tag.name}</Text>
                    </Pressable>
                  ))}
              </View>
            )}
          </View>

          {/* ── Memo ── */}
          <View style={styles.memoSection}>
            <Text style={styles.sectionLabel}>Memo</Text>
            <TextInput
              style={styles.memoInput}
              placeholder="Practice notes..."
              placeholderTextColor="#444"
              multiline
              defaultValue={session.memo}
              onChangeText={handleMemoChange}
              textAlignVertical="top"
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0a0a1a",
  },
  scrollContent: {
    paddingBottom: 40,
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
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  backBtnText: {
    color: "#3B82F6",
    fontSize: 15,
    fontWeight: "600",
  },
  headerTitle: {
    color: "#fff",
    fontSize: 17,
    fontWeight: "700",
    textAlign: "center",
  },
  endBtn: {
    backgroundColor: "rgba(239,68,68,0.25)",
    borderWidth: 1,
    borderColor: "rgba(239,68,68,0.3)",
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 10,
    alignItems: "center",
  },
  endBtnText: {
    color: "#ef4444",
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
    marginHorizontal: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 10,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
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
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  voiceBtnActive: {
    backgroundColor: "rgba(220,38,38,0.3)",
    borderColor: "rgba(220,38,38,0.4)",
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
    borderRadius: 6,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
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

  // Tags section
  sectionLabel: {
    color: "#888",
    fontSize: 12,
    fontWeight: "600",
    marginBottom: 8,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  tagsSection: {
    paddingHorizontal: 16,
    marginTop: 16,
  },
  tagChipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  tagChip: {
    flexDirection: "row",
    backgroundColor: "rgba(59,130,246,0.2)",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  tagChipText: {
    color: "#3B82F6",
    fontSize: 12,
    fontWeight: "600",
  },
  tagChipRemove: {
    color: "#3B82F6",
    fontSize: 12,
    fontWeight: "600",
  },
  tagAddBtn: {
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  tagAddBtnText: {
    color: "#888",
    fontSize: 12,
    fontWeight: "600",
  },
  tagPicker: {
    marginTop: 8,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    padding: 10,
    gap: 4,
  },
  tagInputRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 4,
  },
  tagInput: {
    flex: 1,
    color: "#fff",
    fontSize: 14,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  tagCreateBtn: {
    backgroundColor: "rgba(59,130,246,0.2)",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    justifyContent: "center",
  },
  tagCreateBtnText: {
    color: "#3B82F6",
    fontSize: 13,
    fontWeight: "600",
  },
  tagPickerItem: {
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  tagPickerItemText: {
    color: "#ccc",
    fontSize: 14,
  },

  // Memo section
  memoSection: {
    paddingHorizontal: 16,
    marginTop: 16,
  },
  memoInput: {
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    color: "#fff",
    fontSize: 14,
    padding: 12,
    minHeight: 80,
  },
});
