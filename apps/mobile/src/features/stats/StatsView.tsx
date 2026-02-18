import { getZoneStats } from "@shoot-creater/core";
import type { Session, Zone } from "@shoot-creater/core";
import { StyleSheet, Text, View } from "react-native";

interface StatsViewProps {
  session: Session;
  zones: Zone[];
}

export function StatsView({ session, zones }: StatsViewProps) {
  const stats = getZoneStats(session);

  if (stats.length === 0) {
    return (
      <View style={styles.container}>
        <Text style={styles.label}>Stats</Text>
        <Text style={styles.empty}>No shots recorded yet</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Stats by Zone</Text>
      {stats.map((s) => {
        const zone = zones.find((z) => z.id === s.zoneId);
        const pct = s.attempted > 0 ? Math.round((s.made / s.attempted) * 100) : 0;
        return (
          <View key={s.zoneId} style={styles.row}>
            <Text style={styles.zoneName}>{zone?.label ?? s.zoneId}</Text>
            <Text style={styles.zoneStats}>
              {s.made}/{s.attempted} ({pct}%)
            </Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 8, padding: 16, backgroundColor: "#1a1a2e", borderRadius: 16 },
  label: { color: "#888", fontSize: 12, textTransform: "uppercase", letterSpacing: 1 },
  empty: { color: "#555", fontSize: 14, textAlign: "center", paddingVertical: 8 },
  row: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 6 },
  zoneName: { color: "#ccc", fontSize: 15 },
  zoneStats: { color: "#fff", fontSize: 15, fontWeight: "600", fontVariant: ["tabular-nums"] },
});
