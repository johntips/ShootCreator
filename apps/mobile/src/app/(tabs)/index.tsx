import { getAllSports } from "@shoot-creater/core";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function HomeScreen() {
  const router = useRouter();
  const sportList = getAllSports();

  return (
    <View style={styles.container}>
      <LinearGradient colors={["#1a1a3e", "#0a0a1a", "#0d1117"]} style={StyleSheet.absoluteFill} />
      <SafeAreaView style={{ flex: 1 }} edges={["top"]}>
        <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: 90 }]}>
          <Text style={styles.title}>ShootCreater</Text>
          <Text style={styles.subtitle}>Select Sport</Text>

          <Pressable
            style={({ pressed }) => [styles.settingsLink, pressed && { opacity: 0.7 }]}
            onPress={() => router.push("/tags")}
          >
            <Text style={styles.settingsLinkText}>Manage Tags</Text>
          </Pressable>

          {sportList.map((sport) => {
            const isReady = sport.zones[0]?.path !== "";
            return (
              <Pressable
                key={sport.id}
                style={({ pressed }) => [
                  styles.card,
                  !isReady && styles.cardDisabled,
                  pressed && styles.cardPressed,
                ]}
                onPress={() => isReady && router.push(`/session/${sport.id}`)}
                disabled={!isReady}
              >
                <View style={styles.cardInner}>
                  <Text style={styles.cardEmoji}>{sport.id === "basketball" ? "🏀" : "🎯"}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardText}>{sport.name}</Text>
                    {isReady ? (
                      <Text style={styles.cardHint}>Tap to start session</Text>
                    ) : (
                      <Text style={styles.cardBadge}>Coming Soon</Text>
                    )}
                  </View>
                </View>
              </Pressable>
            );
          })}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0a0a1a" },
  scroll: { paddingHorizontal: 24, gap: 14 },
  title: {
    color: "#fff",
    fontSize: 32,
    fontWeight: "800",
    letterSpacing: -0.5,
  },
  subtitle: {
    color: "#888",
    fontSize: 15,
    fontWeight: "500",
    marginBottom: 8,
  },
  card: {
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    overflow: "hidden",
  },
  cardDisabled: { opacity: 0.4 },
  cardPressed: { opacity: 0.7, transform: [{ scale: 0.98 }] },
  cardInner: {
    flexDirection: "row",
    alignItems: "center",
    padding: 20,
    gap: 16,
  },
  cardEmoji: { fontSize: 36 },
  cardText: { color: "#fff", fontSize: 20, fontWeight: "700" },
  cardHint: { color: "#666", fontSize: 12, marginTop: 2 },
  cardBadge: { color: "#555", fontSize: 12, marginTop: 2 },
  settingsLink: { alignSelf: "flex-end" },
  settingsLinkText: { color: "#666", fontSize: 13, fontWeight: "500" },
});
