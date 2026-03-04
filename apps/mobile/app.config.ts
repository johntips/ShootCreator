import type { ConfigContext, ExpoConfig } from "expo/config";

const IS_QA = process.env.APP_ENV === "qa";

const config: ExpoConfig = {
  name: IS_QA ? "ShootCreator QA" : "ShootCreator",
  slug: "shootcreator",
  version: "0.1.0",
  scheme: "shootcreator",
  orientation: "portrait",
  userInterfaceStyle: "automatic",
  newArchEnabled: true,
  ios: {
    supportsTablet: false,
    bundleIdentifier: IS_QA ? "com.shootcreator.app.qa" : "com.shootcreator.app",
    appleTeamId: "832VSWQQLH",
    infoPlist: {
      NSSpeechRecognitionUsageDescription: "Voice commands to record shots",
      NSMicrophoneUsageDescription: "Microphone for voice shot recording",
    },
  },
  extra: {
    eas: {
      projectId: "af0e2b64-1fb1-472a-bedf-3ee2602976cb",
    },
  },
  owner: "tuuz",
  plugins: [
    "expo-router",
    [
      "expo-speech-recognition",
      {
        microphonePermission: "Microphone for voice shot recording",
        speechRecognitionPermission: "Voice commands to record shots",
      },
    ],
    ["@bacons/apple-targets"],
    "expo-sqlite",
  ],
};

export default ({ config: _config }: ConfigContext): ExpoConfig => ({
  ..._config,
  ...config,
});
