import { CourtMap } from "@/components/CourtMap";
import { getSessionRepository } from "@/infra/sessionRepository";
import { getTagRepository } from "@/infra/tagRepository";
import { basketball, getSport, getTotalStats, getZoneStats } from "@shoot-creater/core";
import type { Session, Tag } from "@shoot-creater/core";
import { LinearGradient } from "expo-linear-gradient";
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
  const [allTags, setAllTags] = useState<Tag[]>([]);

  useEffect(() => {
    getSessionRepository()
      .getById(id ?? "")
      .then(setSession);
    getTagRepository().getAll().then(setAllTags);
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
    totalStats.attempted > 0 ? Math.round((totalStats.made / totalStats.attempted) * 100) : 0;

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

  const sessionTags = session.tagIds
    .map((tid) => allTags.find((t) => t.id === tid))
    .filter((t): t is Tag => t != null);

  return (
    <>
      <Stack.Screen options={{ title: "Summary", headerShown: false }} />
      <View style={styles.container}>
        <LinearGradient
          colors={["#1a1a3e", "#0a0a1a", "#0d1117"]}
          style={StyleSheet.absoluteFill}
        />
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.title}>Session Complete</Text>
          <Text style={styles.dateText}>{dateStr}</Text>

          {/* Tags */}
          {sessionTags.length > 0 && (
            <View style={styles.tagRow}>
              {sessionTags.map((tag) => (
                <View key={tag.id} style={styles.tagChip}>
                  <Text style={styles.tagChipText}>#{tag.name}</Text>
                </View>
              ))}
            </View>
          )}

          {/* Overall FG */}
          <View style={styles.fgCard}>
            <Text style={styles.fgCount}>
              {totalStats.made} / {totalStats.attempted}
            </Text>
            <Text style={styles.fgPct}>{fgPct}%</Text>
            <Text style={styles.fgLabel}>Field Goal</Text>
          </View>

          {/* Memo */}
          {session.memo.length > 0 && (
            <View style={styles.memoCard}>
              <Text style={styles.memoLabel}>Memo</Text>
              <Text style={styles.memoText}>{session.memo}</Text>
            </View>
          )}

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
      </View>
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
    paddingTop: 60,
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
    marginBottom: 12,
  },
  tagRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 6,
    marginBottom: 16,
  },
  tagChip: {
    backgroundColor: "rgba(139,92,246,0.2)",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  tagChipText: {
    color: "#8B5CF6",
    fontSize: 12,
    fontWeight: "600",
  },
  fgCard: {
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
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
  memoCard: {
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    padding: 14,
    marginBottom: 20,
  },
  memoLabel: {
    color: "#888",
    fontSize: 11,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  memoText: {
    color: "#ccc",
    fontSize: 14,
    lineHeight: 20,
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
    borderBottomColor: "rgba(255,255,255,0.06)",
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
    backgroundColor: "rgba(34,197,94,0.25)",
    borderWidth: 1,
    borderColor: "rgba(34,197,94,0.3)",
  },
  homeBtn: {
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  actionBtnText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },
});
