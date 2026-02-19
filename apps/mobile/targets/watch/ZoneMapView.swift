import SwiftUI

// ━━ ゾーン定義（basketball.ts と完全一致 — 19ゾーン） ━━

struct ZoneInfo: Identifiable {
    let id: String
    let label: String
    let shortLabel: String
    let group: String
}

struct ZoneGroup: Identifiable {
    let id: String
    let label: String
    let color: Color
    let zones: [ZoneInfo]
}

let allZoneGroups: [ZoneGroup] = [
    ZoneGroup(id: "restricted-area", label: "INSIDE", color: .red, zones: [
        ZoneInfo(id: "restricted-area-left",  label: "RA Left",  shortLabel: "RAL", group: "restricted-area"),
        ZoneInfo(id: "restricted-area-right", label: "RA Right", shortLabel: "RAR", group: "restricted-area"),
    ]),
    ZoneGroup(id: "paint", label: "PAINT", color: .orange, zones: [
        ZoneInfo(id: "paint-left",  label: "Paint Left",  shortLabel: "PL", group: "paint"),
        ZoneInfo(id: "paint-right", label: "Paint Right", shortLabel: "PR", group: "paint"),
    ]),
    ZoneGroup(id: "mid-range", label: "MID-RANGE", color: .purple, zones: [
        ZoneInfo(id: "mid-left-baseline",  label: "Left BL",    shortLabel: "LBL", group: "mid-range"),
        ZoneInfo(id: "mid-left-wing",      label: "Left Wing",  shortLabel: "LW",  group: "mid-range"),
        ZoneInfo(id: "mid-left-elbow",     label: "Left Elbow", shortLabel: "LE",  group: "mid-range"),
        ZoneInfo(id: "mid-free-throw",     label: "Free Throw", shortLabel: "FT",  group: "mid-range"),
        ZoneInfo(id: "mid-right-elbow",    label: "Right Elbow",shortLabel: "RE",  group: "mid-range"),
        ZoneInfo(id: "mid-right-wing",     label: "Right Wing", shortLabel: "RW",  group: "mid-range"),
        ZoneInfo(id: "mid-right-baseline", label: "Right BL",   shortLabel: "RBL", group: "mid-range"),
    ]),
    ZoneGroup(id: "three-point", label: "3-POINT", color: .blue, zones: [
        ZoneInfo(id: "corner-three-left",  label: "Left Corner",  shortLabel: "LC3", group: "three-point"),
        ZoneInfo(id: "above-break-left",   label: "Above BK L",   shortLabel: "ABL", group: "three-point"),
        ZoneInfo(id: "above-break-center", label: "Above BK C",   shortLabel: "ABC", group: "three-point"),
        ZoneInfo(id: "above-break-right",  label: "Above BK R",   shortLabel: "ABR", group: "three-point"),
        ZoneInfo(id: "corner-three-right", label: "Right Corner", shortLabel: "RC3", group: "three-point"),
    ]),
    ZoneGroup(id: "deep", label: "DEEP", color: .pink, zones: [
        ZoneInfo(id: "deep-left",   label: "Deep Left",   shortLabel: "DL", group: "deep"),
        ZoneInfo(id: "deep-center", label: "Deep Center", shortLabel: "DC", group: "deep"),
        ZoneInfo(id: "deep-right",  label: "Deep Right",  shortLabel: "DR", group: "deep"),
    ]),
]

// ━━ グループ選択（1段階目）— グループ集計スタッツ付き ━━

struct ZoneGroupListView: View {
    @EnvironmentObject var session: SessionState
    let onSelectGroup: (ZoneGroup) -> Void

    var body: some View {
        ScrollView {
            VStack(spacing: 6) {
                ForEach(allZoneGroups) { group in
                    let stats = session.groupStats(for: group.id)
                    Button(action: { onSelectGroup(group) }) {
                        HStack(spacing: 6) {
                            Circle()
                                .fill(group.color)
                                .frame(width: 8, height: 8)
                            Text(group.label)
                                .font(.system(size: 13, weight: .bold))
                                .foregroundColor(.white)
                            Spacer()
                            if stats.attempted > 0 {
                                Text("\(stats.made)/\(stats.attempted)")
                                    .font(.system(size: 11, weight: .semibold, design: .rounded))
                                    .foregroundColor(.white.opacity(0.8))
                                let pct = Int(Double(stats.made) / Double(stats.attempted) * 100)
                                Text("\(pct)%")
                                    .font(.system(size: 11, weight: .bold))
                                    .foregroundColor(pctColor(pct))
                            } else {
                                Text("\(group.zones.count)")
                                    .font(.system(size: 11))
                                    .foregroundColor(.gray)
                            }
                            Image(systemName: "chevron.right")
                                .font(.system(size: 9))
                                .foregroundColor(.gray)
                        }
                        .padding(.horizontal, 10)
                        .padding(.vertical, 9)
                        .background(group.color.opacity(0.2))
                        .cornerRadius(10)
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(.horizontal, 4)
        }
    }

    private func pctColor(_ pct: Int) -> Color {
        if pct >= 55 { return .green }
        if pct >= 40 { return .yellow }
        if pct >= 25 { return .orange }
        return .red
    }
}

// ━━ サブゾーン選択（2段階目）— ミニコートマップ ━━
// MiniCourtView は MiniCourtView.swift で定義

// ━━ 2段階ゾーン選択ビュー ━━

struct ZoneMapView: View {
    let onSelect: (String) -> Void
    @State private var selectedGroup: ZoneGroup? = nil

    var body: some View {
        if let group = selectedGroup {
            MiniCourtView(group: group) { zoneId in
                onSelect(zoneId)
                selectedGroup = nil
            }
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Back") { selectedGroup = nil }
                        .font(.system(size: 12))
                }
            }
        } else {
            ZoneGroupListView(onSelectGroup: { group in
                selectedGroup = group
            })
        }
    }
}
