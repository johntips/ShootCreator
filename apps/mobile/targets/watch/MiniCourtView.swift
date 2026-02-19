import SwiftUI

// ━━ ビューポート: グループごとのクロップ矩形 ━━

struct CourtViewport {
    let x: CGFloat
    let y: CGFloat
    let width: CGFloat
    let height: CGFloat

    static let inside   = CourtViewport(x: 100, y: 0, width: 100, height: 80)
    static let paint    = CourtViewport(x: 80,  y: 0, width: 140, height: 145)
    static let midRange = CourtViewport(x: 0,   y: 0, width: 300, height: 230)
    static let three    = CourtViewport(x: 0,   y: 0, width: 300, height: 280)
    static let deep     = CourtViewport(x: 0,   y: 250, width: 300, height: 70)

    static func viewport(for groupId: String) -> CourtViewport {
        switch groupId {
        case "restricted-area": return .inside
        case "paint":           return .paint
        case "mid-range":       return .midRange
        case "three-point":     return .three
        case "deep":            return .deep
        default:                return .three
        }
    }

    func transform(point: CGPoint, in size: CGSize) -> CGPoint {
        let scaleX = size.width / width
        let scaleY = size.height / height
        let scale = min(scaleX, scaleY)
        let offsetX = (size.width - width * scale) / 2
        let offsetY = (size.height - height * scale) / 2
        return CGPoint(
            x: (point.x - x) * scale + offsetX,
            y: (point.y - y) * scale + offsetY
        )
    }

    func transformRadius(_ r: CGFloat, in size: CGSize) -> CGFloat {
        let scale = min(size.width / width, size.height / height)
        return r * scale
    }
}

// ━━ SVG Path パーサー (M, L, Q, A, Z 対応) ━━

func parseSVGPath(_ d: String, viewport: CourtViewport, size: CGSize) -> Path {
    var path = Path()
    let tokens = tokenize(d)
    var i = 0
    var currentPoint = CGPoint.zero

    while i < tokens.count {
        let cmd = tokens[i]
        i += 1

        switch cmd {
        case "M":
            guard i + 1 < tokens.count else { break }
            let pt = viewport.transform(point: CGPoint(x: num(tokens[i]), y: num(tokens[i+1])), in: size)
            path.move(to: pt)
            currentPoint = pt
            i += 2
        case "L":
            guard i + 1 < tokens.count else { break }
            let pt = viewport.transform(point: CGPoint(x: num(tokens[i]), y: num(tokens[i+1])), in: size)
            path.addLine(to: pt)
            currentPoint = pt
            i += 2
        case "Q":
            guard i + 3 < tokens.count else { break }
            let ctrl = viewport.transform(point: CGPoint(x: num(tokens[i]), y: num(tokens[i+1])), in: size)
            let end = viewport.transform(point: CGPoint(x: num(tokens[i+2]), y: num(tokens[i+3])), in: size)
            path.addQuadCurve(to: end, control: ctrl)
            currentPoint = end
            i += 4
        case "A":
            // Arc: A rx,ry rotation large-arc-flag sweep-flag x,y
            // Only used for RA arcs: center (150,40), radius 24
            guard i + 6 < tokens.count else { break }
            let endPt = viewport.transform(point: CGPoint(x: num(tokens[i+5]), y: num(tokens[i+6])), in: size)
            let center = viewport.transform(point: CGPoint(x: 150, y: 40), in: size)
            let r = viewport.transformRadius(24, in: size)
            let sweepFlag = Int(num(tokens[i+4]))

            let startAngle = atan2(currentPoint.y - center.y, currentPoint.x - center.x)
            let endAngle = atan2(endPt.y - center.y, endPt.x - center.x)

            path.addArc(
                center: center,
                radius: r,
                startAngle: Angle(radians: Double(startAngle)),
                endAngle: Angle(radians: Double(endAngle)),
                clockwise: sweepFlag == 0
            )
            currentPoint = endPt
            i += 7
        case "Z":
            path.closeSubpath()
        default:
            break
        }
    }
    return path
}

private func tokenize(_ d: String) -> [String] {
    var result: [String] = []
    var current = ""
    for ch in d {
        if ch == "," || ch == " " {
            if !current.isEmpty {
                result.append(current)
                current = ""
            }
        } else if ch.isLetter {
            if !current.isEmpty {
                result.append(current)
                current = ""
            }
            result.append(String(ch))
        } else {
            current.append(ch)
        }
    }
    if !current.isEmpty { result.append(current) }
    return result
}

private func num(_ s: String) -> CGFloat {
    CGFloat(Double(s) ?? 0)
}

// ━━ ゾーン別パスデータ (basketball.ts と一致) ━━

struct ZonePathData {
    let id: String
    let path: String
    let labelX: CGFloat
    let labelY: CGFloat
    let shortLabel: String
    let group: String
}

let allZonePaths: [ZonePathData] = [
    ZonePathData(id: "restricted-area-left", path: "M 126,6 L 126,40 A 24,24 0 0,0 150,64 L 150,6 Z", labelX: 138, labelY: 35, shortLabel: "RAL", group: "restricted-area"),
    ZonePathData(id: "restricted-area-right", path: "M 150,6 L 150,64 A 24,24 0 0,0 174,40 L 174,6 Z", labelX: 162, labelY: 35, shortLabel: "RAR", group: "restricted-area"),
    ZonePathData(id: "paint-left", path: "M 102,6 L 126,6 L 126,40 A 24,24 0 0,0 150,64 L 150,126 L 102,126 Z", labelX: 120, labelY: 96, shortLabel: "PL", group: "paint"),
    ZonePathData(id: "paint-right", path: "M 150,64 A 24,24 0 0,0 174,40 L 174,6 L 198,6 L 198,126 L 150,126 Z", labelX: 180, labelY: 96, shortLabel: "PR", group: "paint"),
    ZonePathData(id: "mid-left-baseline", path: "M 22,6 L 102,6 L 102,90 L 22,90 Z", labelX: 62, labelY: 48, shortLabel: "LBL", group: "mid-range"),
    ZonePathData(id: "mid-right-baseline", path: "M 198,6 L 278,6 L 278,90 L 198,90 Z", labelX: 238, labelY: 48, shortLabel: "RBL", group: "mid-range"),
    ZonePathData(id: "mid-left-wing", path: "M 22,90 L 102,90 L 102,126 L 28,126 Q 23,109 22,90 Z", labelX: 62, labelY: 108, shortLabel: "LW", group: "mid-range"),
    ZonePathData(id: "mid-right-wing", path: "M 198,90 L 278,90 Q 277,109 272,126 L 198,126 Z", labelX: 238, labelY: 108, shortLabel: "RW", group: "mid-range"),
    ZonePathData(id: "mid-left-elbow", path: "M 28,126 L 102,126 L 102,201 Q 44,181 28,126 Z", labelX: 62, labelY: 164, shortLabel: "LE", group: "mid-range"),
    ZonePathData(id: "mid-right-elbow", path: "M 198,126 L 272,126 Q 256,181 198,201 Z", labelX: 238, labelY: 164, shortLabel: "RE", group: "mid-range"),
    ZonePathData(id: "mid-free-throw", path: "M 102,126 L 198,126 L 198,201 Q 177,208 150,210 Q 123,208 102,201 Z", labelX: 150, labelY: 168, shortLabel: "FT", group: "mid-range"),
    ZonePathData(id: "corner-three-left", path: "M 0,6 L 22,6 L 22,90 L 0,90 Z", labelX: 11, labelY: 48, shortLabel: "LC3", group: "three-point"),
    ZonePathData(id: "corner-three-right", path: "M 278,6 L 300,6 L 300,90 L 278,90 Z", labelX: 289, labelY: 48, shortLabel: "RC3", group: "three-point"),
    ZonePathData(id: "above-break-left", path: "M 0,90 L 22,90 Q 28,175 102,201 L 102,274 L 0,274 Z", labelX: 40, labelY: 200, shortLabel: "ABL", group: "three-point"),
    ZonePathData(id: "above-break-right", path: "M 278,90 L 300,90 L 300,274 L 198,274 L 198,201 Q 272,175 278,90 Z", labelX: 260, labelY: 200, shortLabel: "ABR", group: "three-point"),
    ZonePathData(id: "above-break-center", path: "M 102,201 Q 123,208 150,210 Q 177,208 198,201 L 198,274 L 102,274 Z", labelX: 150, labelY: 242, shortLabel: "ABC", group: "three-point"),
    ZonePathData(id: "deep-left", path: "M 0,274 L 100,274 L 100,320 L 0,320 Z", labelX: 50, labelY: 297, shortLabel: "DL", group: "deep"),
    ZonePathData(id: "deep-center", path: "M 100,274 L 200,274 L 200,320 L 100,320 Z", labelX: 150, labelY: 297, shortLabel: "DC", group: "deep"),
    ZonePathData(id: "deep-right", path: "M 200,274 L 300,274 L 300,320 L 200,320 Z", labelX: 250, labelY: 297, shortLabel: "DR", group: "deep"),
]

// ━━ FG% ヒートマップ色 ━━

func zoneFillColor(made: Int, attempted: Int, isSelected: Bool, isTargetGroup: Bool, groupColor: Color) -> Color {
    if isSelected {
        return groupColor.opacity(0.7)
    }
    if !isTargetGroup {
        return Color.white.opacity(0.06)
    }
    if attempted == 0 {
        return groupColor.opacity(0.2)
    }
    let pct = Double(made) / Double(attempted) * 100
    if pct >= 55 { return Color.green.opacity(0.5) }
    if pct >= 40 { return Color.yellow.opacity(0.4) }
    if pct >= 25 { return Color.orange.opacity(0.4) }
    return Color.red.opacity(0.4)
}

// ━━ ミニコートマップビュー ━━

struct MiniCourtView: View {
    @EnvironmentObject var session: SessionState
    let group: ZoneGroup
    let onSelectZone: (String) -> Void

    var body: some View {
        GeometryReader { geo in
            let vp = CourtViewport.viewport(for: group.id)
            let size = geo.size

            ZStack {
                // コートライン (コンテキスト)
                CourtLinesView(viewport: vp, size: size)

                // ゾーン描画
                ForEach(allZonePaths, id: \.id) { zoneData in
                    let isTargetGroup = zoneData.group == group.id
                    let isSelected = zoneData.id == session.selectedZoneId
                    let count = session.zoneCounts[zoneData.id]
                    let made = count?.made ?? 0
                    let attempted = count?.attempted ?? 0
                    let zonePath = parseSVGPath(zoneData.path, viewport: vp, size: size)
                    let labelPt = vp.transform(point: CGPoint(x: zoneData.labelX, y: zoneData.labelY), in: size)

                    // ゾーンの塗りつぶし
                    zonePath
                        .fill(zoneFillColor(
                            made: made,
                            attempted: attempted,
                            isSelected: isSelected,
                            isTargetGroup: isTargetGroup,
                            groupColor: group.color
                        ))

                    // ゾーンのボーダー
                    zonePath
                        .stroke(
                            isSelected ? Color.white : (isTargetGroup ? Color.white.opacity(0.3) : Color.white.opacity(0.1)),
                            lineWidth: isSelected ? 2 : 0.5
                        )

                    // ラベル (ターゲットグループのみ)
                    if isTargetGroup {
                        VStack(spacing: 0) {
                            Text(zoneData.shortLabel)
                                .font(.system(size: 8, weight: .bold))
                                .foregroundColor(.white)
                            if attempted > 0 {
                                Text("\(made)/\(attempted)")
                                    .font(.system(size: 7, weight: .medium, design: .rounded))
                                    .foregroundColor(.white.opacity(0.8))
                            }
                        }
                        .position(labelPt)
                    }

                    // タップ領域 (ターゲットグループのみ)
                    if isTargetGroup {
                        zonePath
                            .fill(Color.clear)
                            .contentShape(zonePath)
                            .onTapGesture {
                                onSelectZone(zoneData.id)
                            }
                    }
                }
            }
        }
        .aspectRatio(CourtViewport.viewport(for: group.id).width / CourtViewport.viewport(for: group.id).height, contentMode: .fit)
        .navigationTitle(group.label)
    }
}

// ━━ コートライン描画 ━━

struct CourtLinesView: View {
    let viewport: CourtViewport
    let size: CGSize

    var body: some View {
        Path { path in
            // ペイント外枠
            let paintTL = viewport.transform(point: CGPoint(x: 102, y: 6), in: size)
            let paintTR = viewport.transform(point: CGPoint(x: 198, y: 6), in: size)
            let paintBR = viewport.transform(point: CGPoint(x: 198, y: 126), in: size)
            let paintBL = viewport.transform(point: CGPoint(x: 102, y: 126), in: size)
            path.move(to: paintTL)
            path.addLine(to: paintTR)
            path.addLine(to: paintBR)
            path.addLine(to: paintBL)
            path.closeSubpath()

            // ベースライン
            let blL = viewport.transform(point: CGPoint(x: 0, y: 6), in: size)
            let blR = viewport.transform(point: CGPoint(x: 300, y: 6), in: size)
            path.move(to: blL)
            path.addLine(to: blR)

            // ハーフコートライン
            let hcL = viewport.transform(point: CGPoint(x: 0, y: 274), in: size)
            let hcR = viewport.transform(point: CGPoint(x: 300, y: 274), in: size)
            path.move(to: hcL)
            path.addLine(to: hcR)
        }
        .stroke(Color.white.opacity(0.15), lineWidth: 0.5)
    }
}
