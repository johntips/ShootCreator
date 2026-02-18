import { getTotalStats, getZoneStats } from "@shoot-creater/core";
import type { Session } from "@shoot-creater/core";
import { Pressable, StyleSheet, Text, View } from "react-native";

interface CounterProps {
  session: Session;
  zoneId: string;
  onShot: (made: boolean) => void;
}

export function Counter({ session, zoneId, onShot }: CounterProps) {
  const zoneStats = getZoneStats(session).find((s) => s.zoneId === zoneId);
  const total = getTotalStats(session);
  const made = zoneStats?.made ?? 0;
  const attempted = zoneStats?.attempted ?? 0;

  return (
    <View style={styles.container}>
      <View style={styles.statsRow}>
        <View style={styles.statBlock}>
          <Text style={styles.statLabel}>Zone</Text>
          <Text style={styles.statValue}>
            {made} / {attempted}
          </Text>
        </View>
        <View style={styles.statBlock}>
          <Text style={styles.statLabel}>Total</Text>
          <Text style={styles.statValue}>
            {total.made} / {total.attempted}
          </Text>
        </View>
      </View>

      <View style={styles.buttonRow}>
        <Pressable style={[styles.button, styles.missButton]} onPress={() => onShot(false)}>
          <Text style={styles.buttonText}>MISS</Text>
        </Pressable>
        <Pressable style={[styles.button, styles.madeButton]} onPress={() => onShot(true)}>
          <Text style={styles.buttonText}>MADE</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 16 },
  statsRow: { flexDirection: "row", justifyContent: "space-around" },
  statBlock: { alignItems: "center" },
  statLabel: { color: "#888", fontSize: 14 },
  statValue: { color: "#fff", fontSize: 32, fontWeight: "700", fontVariant: ["tabular-nums"] },
  buttonRow: { flexDirection: "row", gap: 12 },
  button: { flex: 1, padding: 18, borderRadius: 14, alignItems: "center" },
  missButton: { backgroundColor: "#c0392b" },
  madeButton: { backgroundColor: "#27ae60" },
  buttonText: { color: "#fff", fontSize: 18, fontWeight: "700" },
});
