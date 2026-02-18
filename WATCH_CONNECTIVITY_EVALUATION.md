# watchOS 連携 評価シート

## WCSession API 評価

ユーザーから提供されたアドバイスを基に、各 WatchConnectivity API の特性と ShootCreater での採用判断を評価。

### API 比較表

| API | 特性 | 信頼性 | 速度 | データ制約 | 両デバイス必須 |
|-----|------|--------|------|-----------|--------------|
| `sendMessage` | リアルタイム通信 | 低（接続中のみ） | 最速 | Dict/Data | Yes (reachable) |
| `transferUserInfo` | キュー型転送 | 高（保証配達） | 遅延あり | Dict | No |
| `updateApplicationContext` | 最新状態上書き | 高 | 遅延あり | Dict（最新1件のみ） | No |

### ShootCreater での用途別 API 選定

| ユースケース | 選定 API | 理由 | フォールバック |
|-------------|---------|------|--------------|
| **ショット記録の同期** | `transferUserInfo` | キューに溜まるため1発も漏れない。Watch→iPhone で各ショットを確実に転送 | なし（最も信頼性が高い） |
| **ゾーン変更の通知** | `updateApplicationContext` | 最新の選択ゾーンだけが重要。古いゾーン変更は不要 | `sendMessage` でリアルタイム補助 |
| **リアルタイムカウント表示** | `sendMessage` | iPhone 側のカウント更新を Watch に即反映。失敗しても致命的ではない | `updateApplicationContext` で最新状態を補完 |
| **セッション開始/終了** | `sendMessage` + `transferUserInfo` | まず即時通知、失敗時は確実なキュー転送 | — |

---

## 評価項目チェックリスト

### 1. ショットデータの信頼性

| # | 観点 | 評価 | 対策 |
|---|------|------|------|
| 1 | Watch 単体でショット記録が完結するか | OK | Watch ローカルにもショットを保存。iPhone 不在でも動作 |
| 2 | ショットの重複カウント防止 | 要注意 | Shot に UUID + timestamp を付与。iPhone 側で dedup |
| 3 | iPhone と Watch の同時入力で矛盾しないか | 要注意 | 同一セッションに追記（append-only）。timestamp で整列 |
| 4 | 通信途絶時のデータ保全 | OK | `transferUserInfo` のキューが復旧時に自動送信 |

### 2. ゾーン同期

| # | 観点 | 評価 | 対策 |
|---|------|------|------|
| 1 | iPhone でゾーン変更 → Watch に反映 | OK | `updateApplicationContext` で最新ゾーン送信 |
| 2 | Watch でゾーン変更 → iPhone に反映 | OK | 同上（双方向） |
| 3 | 同時にゾーン変更した場合 | 許容 | 最後の変更が勝つ（last-write-wins）。各デバイスは独立動作 |
| 4 | ゾーン変更の遅延許容度 | OK | 数秒の遅延は運用上問題なし |

### 3. セッション管理

| # | 観点 | 評価 | 対策 |
|---|------|------|------|
| 1 | iPhone でセッション開始 → Watch に反映 | OK | `sendMessage` + `updateApplicationContext` |
| 2 | Watch 単体でセッション開始 | 検討中 | Watch は iPhone のセッションに参加する形が安全 |
| 3 | セッション終了時のデータ集約 | OK | iPhone が master。Watch の未送信ショットを集約 |
| 4 | 24h 自動カットの同期 | 要注意 | iPhone 側で判定し、Watch に通知 |

### 4. 接続安定性

| # | 観点 | 評価 | 対策 |
|---|------|------|------|
| 1 | Bluetooth 切断からの復帰 | OK | WCSession の自動再接続 + `transferUserInfo` のキュー |
| 2 | Simulator での動作確認 | 制限あり | sendMessage は Simulator 間で動作するが不安定。実機テスト推奨 |
| 3 | バックグラウンドでの通信 | OK | WCSession はバックグラウンド転送をサポート |
| 4 | iPhone ロック中の受信 | OK | `transferUserInfo` は OS レベルで処理 |

---

## Watch UI 2モード設計

### モード 1: ゾーン再選択モード
```
┌──────────────────┐
│  Zone Select     │
│                  │
│  [ゴール下]       │
│  [ペイント]       │
│  [ミドルレンジ]    │
│  [スリーポイント]  │
│  [ディープレンジ]  │
│                  │
└──────────────────┘
```
- タップで大分類 → サブゾーン → Counting に遷移
- 素早くゾーンを切り替えたい場合に使用

### モード 2: ズームイン確認モード
```
┌──────────────────┐
│  << Zone Select  │
│                  │
│  Mid-Range       │
│  ┌────────────┐  │
│  │左BL  3/5 60%│  │
│  │左WG  2/4 50%│  │
│  │左EL  1/3 33%│  │
│  │ FT   4/6 67%│  │
│  │右EL  2/5 40%│  │
│  │右WG  1/2 50%│  │
│  │右BL  3/4 75%│  │
│  └────────────┘  │
│                  │
│  Group: 16/29    │
│         55.2%    │
│                  │
└──────────────────┘
```
- グループ内全ゾーンの m/n と FG% を一覧表示
- タップで特定ゾーンの Counting に遷移
- グループ全体の集計も表示

### モード切替
- CountingView の「Zone」ボタン → モード 1（ゾーン再選択）
- CountingView で上スワイプ → モード 2（ズームイン確認）

---

## 実装優先度

| 優先度 | 項目 | 理由 |
|--------|------|------|
| P0 | Watch 単体カウント | Watch のみでシュート練習を完結させる最低限の機能 |
| P0 | ゾーン選択（2段階） | 17ゾーンを Watch で選択するために必須 |
| P1 | ショット同期（transferUserInfo） | iPhone との連携。Watch 単体が先 |
| P1 | ゾーン同期（applicationContext） | iPhone と Watch でゾーンを同期 |
| P2 | リアルタイム表示（sendMessage） | iPhone の操作を Watch に即反映 |
| P2 | ズームイン確認モード | 統計確認。基本機能の後でOK |
| P3 | iPhone からの Watch 制御 | iPhone 側から Watch のゾーンを変更 |

---

## 技術メモ

### WCSession セットアップ（Swift / SwiftUI）
```swift
// WatchConnectivityManager.swift
class WCManager: NSObject, WCSessionDelegate {
    static let shared = WCManager()

    func activate() {
        if WCSession.isSupported() {
            let session = WCSession.default
            session.delegate = self
            session.activate()
        }
    }

    // ショット送信（Watch → iPhone）
    func sendShot(_ shot: [String: Any]) {
        WCSession.default.transferUserInfo(shot)
    }

    // ゾーン変更通知
    func updateZone(_ zoneId: String) {
        try? WCSession.default.updateApplicationContext(["activeZone": zoneId])
    }

    // リアルタイム通知（接続中のみ）
    func sendRealtimeUpdate(_ data: [String: Any]) {
        if WCSession.default.isReachable {
            WCSession.default.sendMessage(data, replyHandler: nil)
        }
    }
}
```

### react-native-watch-connectivity（iPhone 側）
```typescript
// React Native 側では react-native-watch-connectivity を使用
import { watchEvents, sendMessage, updateApplicationContext } from 'react-native-watch-connectivity';

// Watch からのショット受信
watchEvents.on('message', (message) => {
    if (message.type === 'shot') {
        // セッションに追加
    }
});

// ゾーン変更を Watch に通知
updateApplicationContext({ activeZone: selectedZoneId });
```
