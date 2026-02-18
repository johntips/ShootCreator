import Foundation
import Combine

/// Zone別の成功/試行カウント
struct ZoneCount: Identifiable {
    let id: String
    var made: Int = 0
    var attempted: Int = 0

    var percentage: Int {
        attempted > 0 ? Int(Double(made) / Double(attempted) * 100) : 0
    }
}

/// セッション状態管理（19ゾーン対応）
class SessionState: ObservableObject {
    @Published var selectedZoneId: String = "restricted-area-left"
    @Published var zoneCounts: [String: ZoneCount] = [:]

    private var cancellables = Set<AnyCancellable>()

    init() {
        // iPhone → Watch のゾーン変更を受信
        NotificationCenter.default.publisher(for: .zoneChangedFromiPhone)
            .compactMap { $0.userInfo?["zoneId"] as? String }
            .receive(on: DispatchQueue.main)
            .sink { [weak self] zoneId in
                self?.selectedZoneId = zoneId
            }
            .store(in: &cancellables)

        // iPhone → Watch のカウント同期を受信
        NotificationCenter.default.publisher(for: .statsUpdatedFromiPhone)
            .compactMap { $0.userInfo as? [String: Any] }
            .receive(on: DispatchQueue.main)
            .sink { [weak self] data in
                self?.mergeStatsFromiPhone(data)
            }
            .store(in: &cancellables)
    }

    var currentZone: ZoneCount {
        zoneCounts[selectedZoneId] ?? ZoneCount(id: selectedZoneId)
    }

    /// 選択中ゾーンのグループ情報
    var currentGroup: ZoneGroup? {
        allZoneGroups.first { group in
            group.zones.contains { $0.id == selectedZoneId }
        }
    }

    /// 選択中ゾーンの表示ラベル
    var currentZoneLabel: String {
        for group in allZoneGroups {
            if let zone = group.zones.first(where: { $0.id == selectedZoneId }) {
                return zone.shortLabel
            }
        }
        return selectedZoneId
    }

    var totalMade: Int {
        zoneCounts.values.reduce(0) { $0 + $1.made }
    }

    var totalAttempted: Int {
        zoneCounts.values.reduce(0) { $0 + $1.attempted }
    }

    var totalPercentage: Int {
        totalAttempted > 0 ? Int(Double(totalMade) / Double(totalAttempted) * 100) : 0
    }

    func recordShot(made: Bool) {
        var count = zoneCounts[selectedZoneId] ?? ZoneCount(id: selectedZoneId)
        if made { count.made += 1 }
        count.attempted += 1
        zoneCounts[selectedZoneId] = count
    }

    /// グループ内の集計
    func groupStats(for groupId: String) -> (made: Int, attempted: Int) {
        guard let group = allZoneGroups.first(where: { $0.id == groupId }) else {
            return (0, 0)
        }
        var made = 0
        var attempted = 0
        for zone in group.zones {
            if let count = zoneCounts[zone.id] {
                made += count.made
                attempted += count.attempted
            }
        }
        return (made, attempted)
    }

    /// iPhone から受信したスタッツをマージ
    private func mergeStatsFromiPhone(_ data: [String: Any]) {
        guard let zones = data["zoneStats"] as? [[String: Any]] else { return }
        for zoneStat in zones {
            guard let zoneId = zoneStat["zoneId"] as? String,
                  let made = zoneStat["made"] as? Int,
                  let attempted = zoneStat["attempted"] as? Int else { continue }
            zoneCounts[zoneId] = ZoneCount(id: zoneId, made: made, attempted: attempted)
        }
    }
}
