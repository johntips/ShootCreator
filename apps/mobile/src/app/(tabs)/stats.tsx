import { CourtMap } from "@/components/CourtMap";
import { useSessionHistory, useTagStore } from "@/infra/storage";
import {
  basketball,
  getAggregateTotalStats,
  getAggregateZoneStats,
  getGroupStats,
} from "@shoot-creater/core";
import type { ZoneStats } from "@shoot-creater/core";
import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

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

type Filter = "all" | "month" | "week";

export default function StatsScreen() {
  const { sessions, refresh } = useSessionHistory();
  const { tags, refresh: refreshTags } = useTagStore();
  const [filter, setFilter] = useState<Filter>("all");
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      refresh();
      refreshTags();
    }, [refresh, refreshTags]),
  );

  const toggleTagFilter = useCallback((tagId: string) => {
    setSelectedTagIds((prev) =>
      prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId],
    );
  }, []);

  const filtered = useMemo(() => {
    let result = sessions;
    if (filter !== "all") {
      const now = Date.now();
      const cutoff = filter === "week" ? now - 7 * 86400000 : now - 30 * 86400000;
      result = result.filter((s) => s.startedAt >= cutoff);
    }
    if (selectedTagIds.length > 0) {
      result = result.filter((s) => selectedTagIds.some((tagId) => s.tagIds.includes(tagId)));
    }
    return result;
  }, [sessions, filter, selectedTagIds]);

  const totalStats = useMemo(() => getAggregateTotalStats(filtered), [filtered]);
  const zoneStats = useMemo(() => getAggregateZoneStats(filtered), [filtered]);
  const groupStats = useMemo(() => getGroupStats(zoneStats, basketball), [zoneStats]);
  const totalPct =
    totalStats.attempted > 0 ? Math.round((totalStats.made / totalStats.attempted) * 100) : null;

  const zoneStatsForGroup = (groupId: string): ZoneStats[] => {
    const groupZoneIds = basketball.zones.filter((z) => z.group === groupId).map((z) => z.id);
    return zoneStats.filter((s) => groupZoneIds.includes(s.zoneId));
  };

  return (
    <View style={styles.container}>
      <LinearGradient colors={["#1a1a3e", "#0a0a1a", "#0d1117"]} style={StyleSheet.absoluteFill} />
      <SafeAreaView style={{ flex: 1 }} edges={["top"]}>
        <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: 90 }]}>
          {/* ── Header ── */}
          <Text style={styles.title}>Stats</Text>

          {/* ── Period Filter ── */}
          <View style={styles.filterRow}>
            {(["all", "month", "week"] as Filter[]).map((f) => (
              <Pressable
                key={f}
                style={[styles.filterBtn, filter === f && styles.filterBtnActive]}
                onPress={() => setFilter(f)}
              >
                <Text style={[styles.filterText, filter === f && styles.filterTextActive]}>
                  {f === "all" ? "All Time" : f === "month" ? "30 Days" : "7 Days"}
                </Text>
              </Pressable>
            ))}
          </View>

          {/* ── Tag Filter ── */}
          {tags.length > 0 && (
            <View style={styles.tagFilterRow}>
              <Pressable
                style={[styles.filterBtn, selectedTagIds.length === 0 && styles.filterBtnActive]}
                onPress={() => setSelectedTagIds([])}
              >
                <Text
                  style={[
                    styles.filterText,
                    selectedTagIds.length === 0 && styles.filterTextActive,
                  ]}
                >
                  All
                </Text>
              </Pressable>
              {tags.map((tag) => (
                <Pressable
                  key={tag.id}
                  style={[
                    styles.tagFilterBtn,
                    selectedTagIds.includes(tag.id) && styles.tagFilterBtnActive,
                  ]}
                  onPress={() => toggleTagFilter(tag.id)}
                >
                  <Text
                    style={[
                      styles.filterText,
                      selectedTagIds.includes(tag.id) && styles.tagFilterTextActive,
                    ]}
                  >
                    #{tag.name}
                  </Text>
                </Pressable>
              ))}
            </View>
          )}

          {filtered.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyText}>No data yet</Text>
              <Text style={styles.emptyHint}>Complete a session to see stats</Text>
            </View>
          ) : (
            <>
              {/* ── Total FG Card ── */}
              <View style={styles.glassCard}>
                <Text style={styles.totalLabel}>Field Goal</Text>
                <View style={styles.totalRow}>
                  <Text style={styles.totalCount}>
                    {totalStats.made}
                    <Text style={styles.totalSlash}> / </Text>
                    {totalStats.attempted}
                  </Text>
                  <Text style={styles.totalPct}>{totalPct !== null ? `${totalPct}%` : "---"}</Text>
                </View>
                <Text style={styles.totalMeta}>{filtered.length} sessions</Text>
              </View>

              {/* ── Court Heatmap ── */}
              <View style={styles.courtSection}>
                <CourtMap
                  zones={basketball.zones}
                  selectedZoneId=""
                  onSelectZone={() => {}}
                  zoneStats={zoneStats}
                />
              </View>

              {/* ── Group Breakdown ── */}
              <Text style={styles.sectionTitle}>By Zone Group</Text>
              {groupStats.map((gs) => {
                const pct = gs.attempted > 0 ? Math.round((gs.made / gs.attempted) * 100) : null;
                const color = GROUP_COLORS[gs.groupId] ?? "#666";
                const isExpanded = expandedGroup === gs.groupId;
                const zones = zoneStatsForGroup(gs.groupId);

                return (
                  <View key={gs.groupId}>
                    <Pressable
                      style={styles.glassCard}
                      onPress={() => setExpandedGroup(isExpanded ? null : gs.groupId)}
                    >
                      <View style={styles.groupHeader}>
                        <View style={[styles.groupDot, { backgroundColor: color }]} />
                        <Text style={styles.groupLabel}>
                          {GROUP_LABELS[gs.groupId] ?? gs.groupId}
                        </Text>
                        <Text style={styles.groupPct}>{pct !== null ? `${pct}%` : "---"}</Text>
                      </View>
                      {gs.attempted > 0 && (
                        <>
                          <View style={styles.progressBg}>
                            <View
                              style={[
                                styles.progressFill,
                                {
                                  backgroundColor: color,
                                  width: `${pct ?? 0}%`,
                                },
                              ]}
                            />
                          </View>
                          <Text style={styles.groupMeta}>
                            {gs.made}/{gs.attempted}
                          </Text>
                        </>
                      )}
                    </Pressable>

                    {/* ── Expanded Zone Detail ── */}
                    {isExpanded && zones.length > 0 && (
                      <View style={styles.zoneDetail}>
                        {zones
                          .sort((a, b) => b.attempted - a.attempted)
                          .map((zs) => {
                            const zone = basketball.zones.find((z) => z.id === zs.zoneId);
                            const zPct =
                              zs.attempted > 0 ? Math.round((zs.made / zs.attempted) * 100) : null;
                            return (
                              <View key={zs.zoneId} style={styles.zoneRow}>
                                <Text style={styles.zoneLabel}>
                                  {zone?.shortLabel ?? zs.zoneId}
                                </Text>
                                <Text style={styles.zoneName}>{zone?.label ?? ""}</Text>
                                <Text style={styles.zoneCount}>
                                  {zs.made}/{zs.attempted}
                                </Text>
                                <Text style={[styles.zonePct, { color: pctColor(zPct) }]}>
                                  {zPct !== null ? `${zPct}%` : "---"}
                                </Text>
                              </View>
                            );
                          })}
                      </View>
                    )}
                  </View>
                );
              })}
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

function pctColor(pct: number | null): string {
  if (pct === null) return "#555";
  if (pct >= 55) return "#22c55e";
  if (pct >= 40) return "#eab308";
  if (pct >= 25) return "#f97316";
  return "#ef4444";
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0a0a1a" },
  scroll: { padding: 20, gap: 14, paddingBottom: 100 },
  title: {
    color: "#fff",
    fontSize: 32,
    fontWeight: "800",
    letterSpacing: -0.5,
  },

  // Filter
  filterRow: { flexDirection: "row", gap: 8 },
  filterBtn: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  filterBtnActive: {
    backgroundColor: "rgba(59,130,246,0.2)",
    borderColor: "rgba(59,130,246,0.4)",
  },
  filterText: { color: "#888", fontSize: 13, fontWeight: "600" },
  filterTextActive: { color: "#3B82F6" },

  // Tag Filter
  tagFilterRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  tagFilterBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 16,
    backgroundColor: "rgba(139,92,246,0.1)",
    borderWidth: 1,
    borderColor: "rgba(139,92,246,0.15)",
  },
  tagFilterBtnActive: {
    backgroundColor: "rgba(139,92,246,0.25)",
    borderColor: "rgba(139,92,246,0.4)",
  },
  tagFilterTextActive: { color: "#8B5CF6" },

  // Empty
  empty: { alignItems: "center", paddingTop: 60, gap: 8 },
  emptyText: { color: "#555", fontSize: 18, fontWeight: "600" },
  emptyHint: { color: "#444", fontSize: 13 },

  // Glass Card
  glassCard: {
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    padding: 16,
  },

  // Total
  totalLabel: { color: "#888", fontSize: 13, fontWeight: "500" },
  totalRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 12,
    marginTop: 4,
  },
  totalCount: {
    color: "#fff",
    fontSize: 36,
    fontWeight: "800",
    fontVariant: ["tabular-nums"],
  },
  totalSlash: { color: "#555", fontSize: 24, fontWeight: "400" },
  totalPct: { color: "#3B82F6", fontSize: 24, fontWeight: "800" },
  totalMeta: { color: "#666", fontSize: 12, marginTop: 4 },

  // Court
  courtSection: { paddingHorizontal: 0 },

  // Section
  sectionTitle: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "700",
    marginTop: 8,
  },

  // Group
  groupHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  groupDot: { width: 10, height: 10, borderRadius: 5 },
  groupLabel: { color: "#fff", fontSize: 15, fontWeight: "700", flex: 1 },
  groupPct: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "800",
    fontVariant: ["tabular-nums"],
  },
  progressBg: {
    height: 4,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 2,
    marginTop: 10,
    overflow: "hidden",
  },
  progressFill: { height: "100%", borderRadius: 2 },
  groupMeta: { color: "#666", fontSize: 11, marginTop: 4, fontVariant: ["tabular-nums"] },

  // Zone Detail
  zoneDetail: {
    backgroundColor: "rgba(255,255,255,0.03)",
    borderRadius: 12,
    marginTop: 4,
    padding: 12,
    gap: 8,
  },
  zoneRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  zoneLabel: {
    color: "#aaa",
    fontSize: 12,
    fontWeight: "700",
    width: 32,
  },
  zoneName: { color: "#888", fontSize: 12, flex: 1 },
  zoneCount: {
    color: "#ccc",
    fontSize: 12,
    fontWeight: "600",
    fontVariant: ["tabular-nums"],
    width: 40,
    textAlign: "right",
  },
  zonePct: {
    fontSize: 13,
    fontWeight: "800",
    fontVariant: ["tabular-nums"],
    width: 40,
    textAlign: "right",
  },
});
