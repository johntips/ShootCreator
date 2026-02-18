import type { SportConfig } from "@shoot-creater/core";
import { useCallback, useRef, useState } from "react";

/** Lazy import to avoid crash when module isn't available */
async function getSpeechModule() {
  try {
    return await import("expo-speech-recognition");
  } catch {
    return null;
  }
}

export function useVoiceCounter(sportConfig: SportConfig, onShot: (made: boolean) => void) {
  const [isListening, setIsListening] = useState(false);
  const [lastWord, setLastWord] = useState<string | null>(null);
  const cleanupRef = useRef<(() => void) | null>(null);

  const processTranscript = useCallback(
    (transcript: string) => {
      const words = transcript.toLowerCase().split(/\s+/);
      const lastToken = words[words.length - 1];
      if (!lastToken) return;

      setLastWord(lastToken);

      if (sportConfig.voiceCommands.made.includes(lastToken)) {
        onShot(true);
      } else if (sportConfig.voiceCommands.missed.includes(lastToken)) {
        onShot(false);
      }
    },
    [sportConfig, onShot],
  );

  const start = useCallback(async () => {
    const mod = await getSpeechModule();
    if (!mod) return;

    const { ExpoSpeechRecognitionModule } = mod;
    const perm = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
    if (!perm.granted) return;

    // Subscribe to results
    const subscription = ExpoSpeechRecognitionModule.addListener(
      "result",
      (event: { results: Array<{ transcript: string }> }) => {
        const transcript = event.results[0]?.transcript;
        if (transcript) processTranscript(transcript);
      },
    );

    ExpoSpeechRecognitionModule.start({
      lang: "en-US",
      continuous: true,
      interimResults: true,
    });

    cleanupRef.current = () => {
      subscription.remove();
      ExpoSpeechRecognitionModule.stop();
    };

    setIsListening(true);
  }, [processTranscript]);

  const stop = useCallback(async () => {
    cleanupRef.current?.();
    cleanupRef.current = null;
    setIsListening(false);
    setLastWord(null);
  }, []);

  const toggle = useCallback(() => {
    if (isListening) {
      stop();
    } else {
      start();
    }
  }, [isListening, start, stop]);

  return { isListening, lastWord, toggle };
}
