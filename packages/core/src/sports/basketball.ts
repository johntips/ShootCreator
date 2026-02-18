import type { SportConfig } from "../types";

/**
 * バスケットボール ハーフコート 19ゾーン定義
 * NBA.com Shot Chart 準拠 + ディープレンジ + ペイント/RA左右分割
 *
 * viewBox: 0 0 300 320
 * Baseline: y=6, Half-court: y=274, Deep: y=274..320
 * Basket center: (150, 40), Backboard: y=26
 *
 * Court dimensions (~6px/ft):
 *   Paint (key):     x=102..198, y=6..126
 *   RA arc:          24px radius at (150,40), sides at x=126,174
 *   3PT corners:     x=22 / x=278, y=6..90
 *   3PT arc:         Q bezier from (22,90) through (150,210) to (278,90)
 *
 * ── 3PT Arc quadratic bezier ──
 *   Left:  P0=(22,90)  P1=(30,200)  P2=(150,210)
 *   Right: P0=(278,90) P1=(270,200) P2=(150,210)
 *
 * ── Sub-bezier control points (de Casteljau) ──
 *   Left:  (22,90) Q 23,109 (28,126)  |  (28,126) Q 44,181 (102,201)
 *          (102,201) Q 123,208 (150,210)  |  (22,90) Q 28,175 (102,201)
 *   Right: (278,90) Q 277,109 (272,126)  |  (272,126) Q 256,181 (198,201)
 *          (198,201) Q 177,208 (150,210)  |  (278,90) Q 272,175 (198,201)
 *
 * ── RA arc split at x=150 ──
 *   Center of RA: (150,40), radius 24
 *   Bottom of RA arc at x=150: (150,64)
 *   Left half:  (126,40) → A arc → (150,64)
 *   Right half: (150,64) → A arc → (174,40)
 */
export const basketball: SportConfig = {
	id: "basketball",
	name: "Basketball",
	icon: "basketball",
	zones: [
		// ━━ ゴール下 (Restricted Area) — 左右分割 ━━
		{
			id: "restricted-area-left",
			label: "RA Left",
			shortLabel: "RAL",
			group: "restricted-area",
			path: "M 126,6 L 126,40 A 24,24 0 0,0 150,64 L 150,6 Z",
			labelX: 138,
			labelY: 35,
		},
		{
			id: "restricted-area-right",
			label: "RA Right",
			shortLabel: "RAR",
			group: "restricted-area",
			path: "M 150,6 L 150,64 A 24,24 0 0,0 174,40 L 174,6 Z",
			labelX: 162,
			labelY: 35,
		},

		// ━━ ペイント (In The Paint, Non-RA) — 左右分割 ━━
		{
			id: "paint-left",
			label: "Paint Left",
			shortLabel: "PL",
			group: "paint",
			// Left paint rectangle with RA-left cutout
			path: "M 102,6 L 126,6 L 126,40 A 24,24 0 0,0 150,64 L 150,126 L 102,126 Z",
			labelX: 120,
			labelY: 96,
		},
		{
			id: "paint-right",
			label: "Paint Right",
			shortLabel: "PR",
			group: "paint",
			// Right paint rectangle with RA-right cutout
			path: "M 150,64 A 24,24 0 0,0 174,40 L 174,6 L 198,6 L 198,126 L 150,126 Z",
			labelX: 180,
			labelY: 96,
		},

		// ━━ ミドルレンジ (Mid-Range, inside 3PT arc) ━━
		{
			id: "mid-left-baseline",
			label: "Left Baseline",
			shortLabel: "LBL",
			group: "mid-range",
			path: "M 22,6 L 102,6 L 102,90 L 22,90 Z",
			labelX: 62,
			labelY: 48,
		},
		{
			id: "mid-right-baseline",
			label: "Right Baseline",
			shortLabel: "RBL",
			group: "mid-range",
			path: "M 198,6 L 278,6 L 278,90 L 198,90 Z",
			labelX: 238,
			labelY: 48,
		},
		{
			id: "mid-left-wing",
			label: "Left Wing",
			shortLabel: "LW",
			group: "mid-range",
			// Left boundary follows 3PT arc curve
			path: "M 22,90 L 102,90 L 102,126 L 28,126 Q 23,109 22,90 Z",
			labelX: 62,
			labelY: 108,
		},
		{
			id: "mid-right-wing",
			label: "Right Wing",
			shortLabel: "RW",
			group: "mid-range",
			// Right boundary follows 3PT arc curve
			path: "M 198,90 L 278,90 Q 277,109 272,126 L 198,126 Z",
			labelX: 238,
			labelY: 108,
		},
		{
			id: "mid-left-elbow",
			label: "Left Elbow",
			shortLabel: "LE",
			group: "mid-range",
			// Outer boundary follows 3PT arc as smooth Q curve
			path: "M 28,126 L 102,126 L 102,201 Q 44,181 28,126 Z",
			labelX: 62,
			labelY: 164,
		},
		{
			id: "mid-right-elbow",
			label: "Right Elbow",
			shortLabel: "RE",
			group: "mid-range",
			// Outer boundary follows 3PT arc as smooth Q curve
			path: "M 198,126 L 272,126 Q 256,181 198,201 Z",
			labelX: 238,
			labelY: 164,
		},
		{
			id: "mid-free-throw",
			label: "Free Throw",
			shortLabel: "FT",
			group: "mid-range",
			// Bottom boundary follows 3PT arc with two Q curves
			path: "M 102,126 L 198,126 L 198,201 Q 177,208 150,210 Q 123,208 102,201 Z",
			labelX: 150,
			labelY: 168,
		},

		// ━━ スリーポイント (3PT, outside 3PT arc) ━━
		{
			id: "corner-three-left",
			label: "Left Corner 3",
			shortLabel: "LC3",
			group: "three-point",
			path: "M 0,6 L 22,6 L 22,90 L 0,90 Z",
			labelX: 11,
			labelY: 48,
		},
		{
			id: "corner-three-right",
			label: "Right Corner 3",
			shortLabel: "RC3",
			group: "three-point",
			path: "M 278,6 L 300,6 L 300,90 L 278,90 Z",
			labelX: 289,
			labelY: 48,
		},
		{
			id: "above-break-left",
			label: "Above Break 3 Left",
			shortLabel: "ABL",
			group: "three-point",
			// Inner boundary follows full left 3PT arc as single Q curve
			path: "M 0,90 L 22,90 Q 28,175 102,201 L 102,274 L 0,274 Z",
			labelX: 40,
			labelY: 200,
		},
		{
			id: "above-break-right",
			label: "Above Break 3 Right",
			shortLabel: "ABR",
			group: "three-point",
			// Inner boundary follows full right 3PT arc as single Q curve
			path: "M 278,90 L 300,90 L 300,274 L 198,274 L 198,201 Q 272,175 278,90 Z",
			labelX: 260,
			labelY: 200,
		},
		{
			id: "above-break-center",
			label: "Above Break 3 Center",
			shortLabel: "ABC",
			group: "three-point",
			// Top boundary follows 3PT arc with two Q curves
			path: "M 102,201 Q 123,208 150,210 Q 177,208 198,201 L 198,274 L 102,274 Z",
			labelX: 150,
			labelY: 242,
		},

		// ━━ ディープレンジ (Deep Range, beyond half-court) ━━
		{
			id: "deep-left",
			label: "Deep Left",
			shortLabel: "DL",
			group: "deep",
			path: "M 0,274 L 100,274 L 100,320 L 0,320 Z",
			labelX: 50,
			labelY: 297,
		},
		{
			id: "deep-center",
			label: "Deep Center",
			shortLabel: "DC",
			group: "deep",
			path: "M 100,274 L 200,274 L 200,320 L 100,320 Z",
			labelX: 150,
			labelY: 297,
		},
		{
			id: "deep-right",
			label: "Deep Right",
			shortLabel: "DR",
			group: "deep",
			path: "M 200,274 L 300,274 L 300,320 L 200,320 Z",
			labelX: 250,
			labelY: 297,
		},
	],
	voiceCommands: {
		made: ["in", "yes", "made", "good"],
		missed: ["out", "no", "miss", "missed"],
	},
};
