import type { Zone } from "@shoot-creater/core";
import { Pressable, ScrollView, StyleSheet, Text } from "react-native";

interface ZoneSelectorProps {
  zones: Zone[];
  selectedId: string;
  onSelect: (id: string) => void;
}

export function ZoneSelector({ zones, selectedId, onSelect }: ZoneSelectorProps) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.container}
    >
      {zones.map((zone) => (
        <Pressable
          key={zone.id}
          style={[styles.chip, zone.id === selectedId && styles.chipActive]}
          onPress={() => onSelect(zone.id)}
        >
          <Text style={[styles.chipText, zone.id === selectedId && styles.chipTextActive]}>
            {zone.label}
          </Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { gap: 8, paddingVertical: 4 },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: "#1a1a2e",
    borderWidth: 1,
    borderColor: "#333",
  },
  chipActive: { backgroundColor: "#2563eb", borderColor: "#2563eb" },
  chipText: { color: "#999", fontSize: 14, fontWeight: "500" },
  chipTextActive: { color: "#fff" },
});
