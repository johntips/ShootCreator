import { getSyncService } from "@/features/sync/SyncService";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";

export default function RootLayout() {
  // Watch ready ハンドシェイクをアプリ起動時から常時リッスン
  useEffect(() => {
    void getSyncService().initPassiveListener();
  }, []);

  return (
    <>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: "rgba(10,10,26,0.85)" },
          headerTintColor: "#fff",
          contentStyle: { backgroundColor: "#0a0a1a" },
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="session/[sport]" options={{ title: "Session", headerShown: false }} />
        <Stack.Screen name="summary/[id]" options={{ title: "Summary", headerShown: false }} />
        <Stack.Screen name="tags" options={{ title: "Tags", headerShown: false }} />
      </Stack>
    </>
  );
}
