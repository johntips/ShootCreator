import type { Zone, ZoneStats } from "@shoot-creater/core";
import { useCallback } from "react";
import { StyleSheet, View } from "react-native";
import Svg, {
	Circle,
	Defs,
	G,
	Line,
	LinearGradient,
	Path,
	Rect,
	Stop,
	Text as SvgText,
} from "react-native-svg";

// ─── Color Helpers ─────────────────────────────────────────────

function fgToColor(fgPct: number): string {
	if (fgPct >= 55) return "rgba(34,197,94,0.55)";
	if (fgPct >= 40) return "rgba(234,179,8,0.45)";
	if (fgPct >= 25) return "rgba(249,115,22,0.45)";
	return "rgba(239,68,68,0.40)";
}

// ─── Component ─────────────────────────────────────────────────

interface CourtMapProps {
	zones: Zone[];
	selectedZoneId: string;
	onSelectZone: (zoneId: string) => void;
	zoneStats?: ZoneStats[];
}

export function CourtMap({ zones, selectedZoneId, onSelectZone, zoneStats = [] }: CourtMapProps) {
	const statsMap = new Map(zoneStats.map((s) => [s.zoneId, s]));

	const hasDeepZones = zones.some((z) => z.group === "deep");
	const viewBoxHeight = hasDeepZones ? 320 : 280;

	const getZoneFill = useCallback(
		(zoneId: string) => {
			const isSelected = zoneId === selectedZoneId;
			const stat = statsMap.get(zoneId);
			if (isSelected) return "rgba(37,99,235,0.45)";
			if (stat && stat.attempted > 0) {
				const pct = (stat.made / stat.attempted) * 100;
				return fgToColor(pct);
			}
			return "rgba(255,255,255,0.06)";
		},
		[selectedZoneId, statsMap],
	);

	const getFontSize = (zone: Zone): number => {
		if (zone.group === "restricted-area") return 7;
		if (zone.group === "three-point" && zone.id.startsWith("corner")) return 7;
		if (zone.group === "deep") return 8;
		if (zone.id.startsWith("paint")) return 8;
		return 9;
	};

	return (
		<View style={styles.container}>
			<Svg viewBox={`0 0 300 ${viewBoxHeight}`} style={styles.svg}>
				<Defs>
					<LinearGradient id="courtGrad" x1="0" y1="0" x2="0" y2="1">
						<Stop offset="0" stopColor="#C4913D" />
						<Stop offset="0.3" stopColor="#D4A04A" />
						<Stop offset="0.7" stopColor="#C89040" />
						<Stop offset="1" stopColor="#B8802E" />
					</LinearGradient>
					<LinearGradient id="selectGlow" x1="0" y1="0" x2="0" y2="1">
						<Stop offset="0" stopColor="#3B82F6" stopOpacity="0.6" />
						<Stop offset="1" stopColor="#1D4ED8" stopOpacity="0.3" />
					</LinearGradient>
					<LinearGradient id="deepGrad" x1="0" y1="0" x2="0" y2="1">
						<Stop offset="0" stopColor="#B8802E" />
						<Stop offset="1" stopColor="#8B6914" />
					</LinearGradient>
				</Defs>

				{/* ── Court Background ── */}
				<Rect x="0" y="0" width="300" height="274" rx="4" fill="url(#courtGrad)" />
				{hasDeepZones && <Rect x="0" y="274" width="300" height="46" fill="url(#deepGrad)" />}

				{/* ── Court Lines ── */}
				<G stroke="#FFFFFF" strokeWidth="1.5" fill="none" opacity="0.85">
					{/* Baseline */}
					<Line x1="0" y1="6" x2="300" y2="6" />
					{/* Sidelines */}
					<Line x1="0" y1="6" x2="0" y2="274" />
					<Line x1="300" y1="6" x2="300" y2="274" />
					{/* Paint / Key */}
					<Rect x="102" y="6" width="96" height="120" rx="0" />
					{/* Paint center divider (for L/R split) */}
					<Line x1="150" y1="6" x2="150" y2="126" strokeDasharray="3,3" opacity="0.5" />
					{/* Free throw line & circle */}
					<Line x1="102" y1="126" x2="198" y2="126" />
					<Circle cx="150" cy="126" r="36" strokeDasharray="4,4" />
					{/* 3PT corners */}
					<Line x1="22" y1="6" x2="22" y2="90" />
					<Line x1="278" y1="6" x2="278" y2="90" />
					{/* 3PT arc */}
					<Path d="M 22,90 Q 30,200 150,210 Q 270,200 278,90" />
					{/* Restricted area - accurate 4ft arc + straight sides */}
					<Line x1="126" y1="6" x2="126" y2="40" />
					<Path d="M 126,40 A 24,24 0 0,0 174,40" />
					<Line x1="174" y1="40" x2="174" y2="6" />
				</G>

				{/* ── Deep zone area ── */}
				{hasDeepZones && (
					<G stroke="#FFFFFF" fill="none">
						{/* Half-court separator (thin dashed) */}
						<Line
							x1="0" y1="274" x2="300" y2="274"
							strokeWidth="1" strokeDasharray="6,4" opacity="0.5"
						/>
						{/* Sideline extensions for deep */}
						<Line x1="0" y1="274" x2="0" y2="320" strokeWidth="1" opacity="0.4" />
						<Line x1="300" y1="274" x2="300" y2="320" strokeWidth="1" opacity="0.4" />
						{/* Bottom boundary (emphasis line) */}
						<Line
							x1="0" y1="320" x2="300" y2="320"
							strokeWidth="2" opacity="0.85"
						/>
					</G>
				)}

				{/* ── Backboard & Rim ── */}
				<Line x1="136" y1="26" x2="164" y2="26" stroke="#666" strokeWidth="3" />
				<Circle cx="150" cy="40" r="7.5" stroke="#E5451F" strokeWidth="2" fill="none" />
				<Path
					d="M 143,44 L 146,54 M 150,47 L 150,56 M 157,44 L 154,54"
					stroke="#ccc" strokeWidth="0.7" opacity="0.5"
				/>

				{/* ── Tappable Zones ── */}
				{zones.map((zone) => {
					const isSelected = zone.id === selectedZoneId;
					const stat = statsMap.get(zone.id);
					const hasStat = stat && stat.attempted > 0;
					const pct = hasStat ? Math.round((stat.made / stat.attempted) * 100) : null;
					const fontSize = getFontSize(zone);

					return (
						<G key={zone.id} onPress={() => onSelectZone(zone.id)}>
							<Path
								d={zone.path}
								fill={isSelected ? "url(#selectGlow)" : getZoneFill(zone.id)}
								stroke={isSelected ? "#3B82F6" : "rgba(255,255,255,0.15)"}
								strokeWidth={isSelected ? 2 : 0.5}
							/>
							<SvgText
								x={zone.labelX}
								y={zone.labelY - (hasStat ? 4 : 0)}
								textAnchor="middle"
								fontSize={fontSize}
								fontWeight="700"
								fill={isSelected ? "#fff" : "rgba(255,255,255,0.75)"}
							>
								{zone.shortLabel}
							</SvgText>
							{hasStat && (
								<>
									<SvgText
										x={zone.labelX} y={zone.labelY + 10}
										textAnchor="middle" fontSize={8} fontWeight="600"
										fill={isSelected ? "#E0E7FF" : "rgba(255,255,255,0.9)"}
									>
										{stat.made}/{stat.attempted}
									</SvgText>
									<SvgText
										x={zone.labelX} y={zone.labelY + 20}
										textAnchor="middle" fontSize={7} fontWeight="500"
										fill={isSelected ? "#C7D2FE" : "rgba(255,255,255,0.65)"}
									>
										{pct}%
									</SvgText>
								</>
							)}
						</G>
					);
				})}
			</Svg>
		</View>
	);
}

const styles = StyleSheet.create({
	container: {
		width: "100%",
		aspectRatio: 300 / 320,
		borderRadius: 16,
		overflow: "hidden",
		backgroundColor: "#1a1a2e",
	},
	svg: {
		width: "100%",
		height: "100%",
	},
});
