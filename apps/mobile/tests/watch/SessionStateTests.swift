import Foundation

// ═══════════════════════════════════════════════════════════════
// SessionState ユニットテスト
//
// 実行: pnpm test:swift
//   swiftc -parse-as-library apps/mobile/tests/watch/SessionStateTests.swift \
//     -o /tmp/session-state-test && /tmp/session-state-test
//
// ※ SessionState 本体の Combine/NotificationCenter 依存を避けるため、
//    テスト対象のロジックをこのファイル内に複製してテストする。
//    本体との乖離は TypeScript テストで補完。
//
// ※ このファイルは targets/watch/ の外に配置し、Watch ビルドに
//    含まれないようにする（@main 重複回避）。
// ═══════════════════════════════════════════════════════════════

// ── テスト対象のロジック複製 ───────────────────────────────

struct TestZoneCount {
    let id: String
    var made: Int = 0
    var attempted: Int = 0

    var percentage: Int {
        attempted > 0 ? Int(Double(made) / Double(attempted) * 100) : 0
    }
}

/// SessionState のコアロジック（Combine/NotificationCenter 除去版）
class TestSessionState {
    var selectedZoneId: String = "restricted-area-left"
    var zoneCounts: [String: TestZoneCount] = [:]
    var isSessionActive: Bool = false

    var currentZone: TestZoneCount {
        zoneCounts[selectedZoneId] ?? TestZoneCount(id: selectedZoneId)
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
        guard isSessionActive else { return }
        var count = zoneCounts[selectedZoneId] ?? TestZoneCount(id: selectedZoneId)
        if made { count.made += 1 }
        count.attempted += 1
        zoneCounts[selectedZoneId] = count
    }

    func recordRemoteShot(zoneId: String, made: Bool) {
        var count = zoneCounts[zoneId] ?? TestZoneCount(id: zoneId)
        if made { count.made += 1 }
        count.attempted += 1
        zoneCounts[zoneId] = count
    }

    func mergeStatsFromiPhone(_ data: [[String: Any]]) {
        for zoneStat in data {
            guard let zoneId = zoneStat["zoneId"] as? String,
                  let made = zoneStat["made"] as? Int,
                  let attempted = zoneStat["attempted"] as? Int else { continue }
            zoneCounts[zoneId] = TestZoneCount(id: zoneId, made: made, attempted: attempted)
        }
    }

    func simulateSessionStart() {
        zoneCounts.removeAll()
        isSessionActive = true
    }

    func simulateSessionEnd() {
        isSessionActive = false
    }
}

// ── テストランナー ────────────────────────────────────────

var passed = 0
var failed = 0

func test(_ name: String, _ block: () throws -> Void) {
    do {
        try block()
        passed += 1
        print("  ✓ \(name)")
    } catch {
        failed += 1
        print("  ✗ \(name) — \(error)")
    }
}

func assertEqual<T: Equatable>(_ a: T, _ b: T, file: String = #file, line: Int = #line) throws {
    guard a == b else {
        throw TestError.assertion("Expected \(b), got \(a) at \(file):\(line)")
    }
}

func assertTrue(_ value: Bool, file: String = #file, line: Int = #line) throws {
    guard value else {
        throw TestError.assertion("Expected true at \(file):\(line)")
    }
}

func assertFalse(_ value: Bool, file: String = #file, line: Int = #line) throws {
    guard !value else {
        throw TestError.assertion("Expected false at \(file):\(line)")
    }
}

enum TestError: Error, CustomStringConvertible {
    case assertion(String)
    var description: String {
        switch self { case .assertion(let msg): return msg }
    }
}

// ── テストケース ──────────────────────────────────────────

@main
struct SessionStateTests {
    static func main() {
        print("\n━━━ SessionState Tests ━━━\n")

        // ── 初期状態 ──
        print("初期状態:")

        test("isSessionActive は false") {
            let s = TestSessionState()
            try assertFalse(s.isSessionActive)
        }

        test("zoneCounts は空") {
            let s = TestSessionState()
            try assertTrue(s.zoneCounts.isEmpty)
        }

        test("selectedZoneId のデフォルト値") {
            let s = TestSessionState()
            try assertEqual(s.selectedZoneId, "restricted-area-left")
        }

        // ── recordShot (active) ──
        print("\nrecordShot (active):")

        test("MADE → made +1, attempted +1") {
            let s = TestSessionState()
            s.isSessionActive = true
            s.selectedZoneId = "paint"
            s.recordShot(made: true)
            try assertEqual(s.zoneCounts["paint"]!.made, 1)
            try assertEqual(s.zoneCounts["paint"]!.attempted, 1)
        }

        test("MISS → made +0, attempted +1") {
            let s = TestSessionState()
            s.isSessionActive = true
            s.selectedZoneId = "paint"
            s.recordShot(made: false)
            try assertEqual(s.zoneCounts["paint"]!.made, 0)
            try assertEqual(s.zoneCounts["paint"]!.attempted, 1)
        }

        test("連続ショットで正しく加算") {
            let s = TestSessionState()
            s.isSessionActive = true
            s.selectedZoneId = "paint"
            s.recordShot(made: true)
            s.recordShot(made: true)
            s.recordShot(made: false)
            try assertEqual(s.zoneCounts["paint"]!.made, 2)
            try assertEqual(s.zoneCounts["paint"]!.attempted, 3)
        }

        // ── recordShot (idle) ──
        print("\nrecordShot (idle):")

        test("idle 中は zoneCounts 変化なし") {
            let s = TestSessionState()
            s.isSessionActive = false
            s.selectedZoneId = "paint"
            s.recordShot(made: true)
            try assertTrue(s.zoneCounts.isEmpty)
        }

        // ── recordRemoteShot ──
        print("\nrecordRemoteShot:")

        test("指定ゾーンの made/attempted が正しく加算") {
            let s = TestSessionState()
            s.recordRemoteShot(zoneId: "three", made: true)
            try assertEqual(s.zoneCounts["three"]!.made, 1)
            try assertEqual(s.zoneCounts["three"]!.attempted, 1)
        }

        test("未登録ゾーン → 新規 ZoneCount 作成") {
            let s = TestSessionState()
            try assertTrue(s.zoneCounts["new-zone"] == nil)
            s.recordRemoteShot(zoneId: "new-zone", made: false)
            try assertEqual(s.zoneCounts["new-zone"]!.made, 0)
            try assertEqual(s.zoneCounts["new-zone"]!.attempted, 1)
        }

        test("isSessionActive に関係なく記録される") {
            let s = TestSessionState()
            s.isSessionActive = false
            s.recordRemoteShot(zoneId: "paint", made: true)
            try assertEqual(s.zoneCounts["paint"]!.made, 1)
        }

        // ── セッションライフサイクル ──
        print("\nセッションライフサイクル:")

        test("session-start → active + カウントクリア") {
            let s = TestSessionState()
            s.isSessionActive = true
            s.selectedZoneId = "paint"
            s.recordShot(made: true)
            try assertEqual(s.zoneCounts.count, 1)

            s.simulateSessionStart()
            try assertTrue(s.isSessionActive)
            try assertTrue(s.zoneCounts.isEmpty)
        }

        test("session-end → idle") {
            let s = TestSessionState()
            s.isSessionActive = true
            s.simulateSessionEnd()
            try assertFalse(s.isSessionActive)
        }

        // ── currentZone ──
        print("\ncurrentZone:")

        test("カウントがあるゾーン → 正しい値を返す") {
            let s = TestSessionState()
            s.isSessionActive = true
            s.selectedZoneId = "paint"
            s.recordShot(made: true)
            s.recordShot(made: false)
            try assertEqual(s.currentZone.made, 1)
            try assertEqual(s.currentZone.attempted, 2)
        }

        test("未登録ゾーン → 0/0") {
            let s = TestSessionState()
            s.selectedZoneId = "nonexistent"
            try assertEqual(s.currentZone.made, 0)
            try assertEqual(s.currentZone.attempted, 0)
        }

        // ── total 集計 ──
        print("\ntotal 集計:")

        test("totalMade / totalAttempted は全ゾーン合算") {
            let s = TestSessionState()
            s.isSessionActive = true
            s.selectedZoneId = "paint"
            s.recordShot(made: true)
            s.recordShot(made: false)
            s.selectedZoneId = "three"
            s.recordShot(made: true)
            try assertEqual(s.totalMade, 2)
            try assertEqual(s.totalAttempted, 3)
        }

        test("totalPercentage — 0 除算安全") {
            let s = TestSessionState()
            try assertEqual(s.totalPercentage, 0)
        }

        test("totalPercentage — 正しいパーセント") {
            let s = TestSessionState()
            s.isSessionActive = true
            s.selectedZoneId = "paint"
            s.recordShot(made: true)
            s.recordShot(made: false)
            try assertEqual(s.totalPercentage, 50)
        }

        // ── ZoneCount.percentage ──
        print("\nZoneCount.percentage:")

        test("attempted 0 → 0%") {
            let z = TestZoneCount(id: "x")
            try assertEqual(z.percentage, 0)
        }

        test("1/2 → 50%") {
            let z = TestZoneCount(id: "x", made: 1, attempted: 2)
            try assertEqual(z.percentage, 50)
        }

        test("3/3 → 100%") {
            let z = TestZoneCount(id: "x", made: 3, attempted: 3)
            try assertEqual(z.percentage, 100)
        }

        // ── mergeStatsFromiPhone ──
        print("\nmergeStatsFromiPhone:")

        test("iPhone からのスタッツで zoneCounts が上書き") {
            let s = TestSessionState()
            s.mergeStatsFromiPhone([
                ["zoneId": "paint", "made": 5, "attempted": 10],
                ["zoneId": "three", "made": 3, "attempted": 8],
            ])
            try assertEqual(s.zoneCounts["paint"]!.made, 5)
            try assertEqual(s.zoneCounts["paint"]!.attempted, 10)
            try assertEqual(s.zoneCounts["three"]!.made, 3)
            try assertEqual(s.zoneCounts["three"]!.attempted, 8)
        }

        test("不正データはスキップ") {
            let s = TestSessionState()
            s.mergeStatsFromiPhone([
                ["zoneId": "paint"],  // made/attempted 欠落
                ["made": 1, "attempted": 2],  // zoneId 欠落
            ])
            try assertTrue(s.zoneCounts.isEmpty)
        }

        // ── stats snapshot が唯一の更新源 ──
        print("\nstats snapshot が唯一の更新源:")

        test("recordRemoteShot + mergeStats → mergeStats の値が最終結果") {
            let s = TestSessionState()
            // 個別ショットメッセージで加算
            s.recordRemoteShot(zoneId: "paint", made: true)
            try assertEqual(s.zoneCounts["paint"]!.made, 1)
            try assertEqual(s.zoneCounts["paint"]!.attempted, 1)
            // スタッツスナップショットで上書き（これが正）
            s.mergeStatsFromiPhone([
                ["zoneId": "paint", "made": 3, "attempted": 5],
            ])
            try assertEqual(s.zoneCounts["paint"]!.made, 3)
            try assertEqual(s.zoneCounts["paint"]!.attempted, 5)
        }

        test("mergeStats は既存カウントを完全に上書きする") {
            let s = TestSessionState()
            s.isSessionActive = true
            s.selectedZoneId = "paint"
            // Watch ローカルで2ショット
            s.recordShot(made: true)
            s.recordShot(made: false)
            try assertEqual(s.zoneCounts["paint"]!.made, 1)
            try assertEqual(s.zoneCounts["paint"]!.attempted, 2)
            // iPhone からのスタッツで上書き（Watch + iPhone 合計）
            s.mergeStatsFromiPhone([
                ["zoneId": "paint", "made": 4, "attempted": 7],
            ])
            try assertEqual(s.zoneCounts["paint"]!.made, 4)
            try assertEqual(s.zoneCounts["paint"]!.attempted, 7)
        }

        test("mergeStats 後の totalMade/totalAttempted も正しい") {
            let s = TestSessionState()
            s.mergeStatsFromiPhone([
                ["zoneId": "paint", "made": 2, "attempted": 4],
                ["zoneId": "three", "made": 1, "attempted": 3],
            ])
            try assertEqual(s.totalMade, 3)
            try assertEqual(s.totalAttempted, 7)
        }

        // ── ラウンドトリップ（off-by-one 検証） ──
        print("\nラウンドトリップ（off-by-one 検証）:")

        test("Watch ローカル記録 → iPhone stats feedback → off-by-one なし") {
            let s = TestSessionState()
            s.simulateSessionStart()
            s.selectedZoneId = "paint"

            // 1. Watch がローカルでショットを記録
            s.recordShot(made: true)
            try assertEqual(s.zoneCounts["paint"]!.made, 1)
            try assertEqual(s.zoneCounts["paint"]!.attempted, 1)

            // 2. iPhone が Watch ショットを含むスタッツを返却（syncStats）
            //    iPhone はこのショットを受信して自身のセッションに追加済み
            s.mergeStatsFromiPhone([
                ["zoneId": "paint", "made": 1, "attempted": 1],
            ])

            // 3. off-by-one なし: Watch のカウントは iPhone と一致
            try assertEqual(s.zoneCounts["paint"]!.made, 1)
            try assertEqual(s.zoneCounts["paint"]!.attempted, 1)
            try assertEqual(s.totalMade, 1)
            try assertEqual(s.totalAttempted, 1)
        }

        test("Watch 2連ショット → iPhone stats 返却 → カウント一致") {
            let s = TestSessionState()
            s.simulateSessionStart()
            s.selectedZoneId = "paint"

            // 1. Watch がローカルで2ショット記録
            s.recordShot(made: true)
            s.recordShot(made: false)
            try assertEqual(s.zoneCounts["paint"]!.made, 1)
            try assertEqual(s.zoneCounts["paint"]!.attempted, 2)

            // 2. iPhone が1ショット目の stats を返す（この時点で iPhone は1ショットだけ認識）
            s.mergeStatsFromiPhone([
                ["zoneId": "paint", "made": 1, "attempted": 1],
            ])
            // mergeStats は上書きなので一時的に1ショットに見える
            // これは仕様: iPhone からの最新スナップショットが正
            try assertEqual(s.zoneCounts["paint"]!.made, 1)
            try assertEqual(s.zoneCounts["paint"]!.attempted, 1)

            // 3. iPhone が2ショット目も受信し、完全な stats を返す
            s.mergeStatsFromiPhone([
                ["zoneId": "paint", "made": 1, "attempted": 2],
            ])
            // 最終的に正しいカウント
            try assertEqual(s.zoneCounts["paint"]!.made, 1)
            try assertEqual(s.zoneCounts["paint"]!.attempted, 2)
            try assertEqual(s.totalMade, 1)
            try assertEqual(s.totalAttempted, 2)
            try assertEqual(s.totalPercentage, 50)
        }

        test("iPhone 発 + Watch 発混合 → stats feedback で両方反映") {
            let s = TestSessionState()
            s.simulateSessionStart()
            s.selectedZoneId = "paint"

            // 1. Watch がローカルでショット
            s.recordShot(made: true)

            // 2. iPhone 発のリモートショット（別ゾーン）
            s.recordRemoteShot(zoneId: "three", made: false)

            // 3. iPhone が全ショットを含む stats を返却
            s.mergeStatsFromiPhone([
                ["zoneId": "paint", "made": 1, "attempted": 1],
                ["zoneId": "three", "made": 0, "attempted": 1],
            ])

            try assertEqual(s.totalMade, 1)
            try assertEqual(s.totalAttempted, 2)
            try assertEqual(s.zoneCounts["paint"]!.made, 1)
            try assertEqual(s.zoneCounts["three"]!.attempted, 1)
        }

        // ── 結果サマリー ──
        print("\n━━━━━━━━━━━━━━━━━━━━━━━━")
        print("  \(passed) passed, \(failed) failed")
        print("━━━━━━━━━━━━━━━━━━━━━━━━\n")

        if failed > 0 {
            exit(1)
        }
    }
}
