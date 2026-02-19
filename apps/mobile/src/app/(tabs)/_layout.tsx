import { NativeTabs, Icon, Label } from "expo-router/unstable-native-tabs";

export default function TabLayout() {
	return (
		<NativeTabs
			blurEffect="systemChromeMaterialDark"
		>
			<NativeTabs.Trigger name="index">
				<Icon sf={{ default: "house", selected: "house.fill" }} />
				<Label>Home</Label>
			</NativeTabs.Trigger>
			<NativeTabs.Trigger name="history">
				<Icon sf={{ default: "clock", selected: "clock.fill" }} />
				<Label>History</Label>
			</NativeTabs.Trigger>
			<NativeTabs.Trigger name="stats">
				<Icon sf={{ default: "chart.bar", selected: "chart.bar.fill" }} />
				<Label>Stats</Label>
			</NativeTabs.Trigger>
			<NativeTabs.Trigger name="watch">
				<Icon sf={{ default: "applewatch", selected: "applewatch" }} />
				<Label>Watch</Label>
			</NativeTabs.Trigger>
		</NativeTabs>
	);
}
