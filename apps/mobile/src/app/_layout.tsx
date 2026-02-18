import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";

export default function RootLayout() {
	return (
		<>
			<StatusBar style="light" />
			<Stack
				screenOptions={{
					headerStyle: { backgroundColor: "#111" },
					headerTintColor: "#fff",
					contentStyle: { backgroundColor: "#000" },
				}}
			>
				<Stack.Screen name="index" options={{ title: "ShootCreater" }} />
				<Stack.Screen
					name="session/[sport]"
					options={{ title: "Session", headerBackTitle: "Back" }}
				/>
				<Stack.Screen
					name="summary/[id]"
					options={{ title: "Summary" }}
				/>
			</Stack>
		</>
	);
}
