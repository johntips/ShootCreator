import type { SportConfig } from "@shoot-creater/core";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useVoiceCounter } from "./useVoiceCounter";

interface VoicePanelProps {
  sportConfig: SportConfig;
  onShot: (made: boolean) => void;
}

export function VoicePanel({ sportConfig, onShot }: VoicePanelProps) {
  const { isListening, lastWord, toggle } = useVoiceCounter(sportConfig, onShot);

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Voice Input</Text>
      <Pressable style={[styles.button, isListening && styles.buttonActive]} onPress={toggle}>
        <Text style={styles.buttonText}>{isListening ? "STOP" : "START"} VOICE</Text>
      </Pressable>
      {lastWord && (
        <Text style={styles.lastWord}>
          Heard: <Text style={styles.lastWordValue}>{lastWord}</Text>
        </Text>
      )}
      <Text style={styles.hint}>
        Say "{sportConfig.voiceCommands.made[0]}" or "{sportConfig.voiceCommands.missed[0]}"
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 8, padding: 16, backgroundColor: "#1a1a2e", borderRadius: 16 },
  label: { color: "#888", fontSize: 12, textTransform: "uppercase", letterSpacing: 1 },
  button: { padding: 16, borderRadius: 12, backgroundColor: "#333", alignItems: "center" },
  buttonActive: { backgroundColor: "#e74c3c" },
  buttonText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  lastWord: { color: "#888", fontSize: 14, textAlign: "center" },
  lastWordValue: { color: "#fff", fontWeight: "600" },
  hint: { color: "#555", fontSize: 12, textAlign: "center" },
});
