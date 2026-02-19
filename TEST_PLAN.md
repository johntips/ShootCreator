# ShootCreater テスト計画

## 概要

現行仕様をユニットテストで定義し、リグレッション防止基盤を構築する。

- **TypeScript**: Vitest（packages/core + apps/mobile の同期レイヤー）
- **Swift**: Swift Testing framework（watchOS SessionState のロジック）

---

## TypeScript テスト

### 1. packages/core/src/sync.test.ts

| 関数 | テストケース |
|------|------------|
| `createShotId()` | 文字列を返す |
| | タイムスタンプ-ランダム文字列のフォーマット |
| | 連続呼び出しでユニークな ID を生成 |
| `isDuplicate()` | 未出の shotId → false を返し Set に登録 |
| | 既出の shotId → true を返す |
| | 異なる shotId は独立判定 |
| `syncShotToShot()` | SyncShot → Shot 変換（shotId, source を除去） |
| `deriveStatsSyncPayload()` | 空セッション → 空配列 |
| | 単一ゾーンのショット → 正しい made/attempted |
| | 複数ゾーンのショット → ゾーン別集計 |
| | made/miss の正しいカウント |

### 2. packages/core/src/session.test.ts

| 関数 | テストケース |
|------|------------|
| `createSession()` | sportId が設定される |
| | shots が空配列 |
| | endedAt が null |
| | tagIds のデフォルト空配列 |
| | tagIds 指定時に反映 |
| | id がユニーク |
| `addShot()` | ショットが末尾に追加される |
| | 元のセッションは不変（immutable） |
| `undoLastShot()` | 最後のショットが除去される |
| | 空 shots でも安全に動作 |
| | 元のセッションは不変 |
| `endSession()` | endedAt にタイムスタンプが設定される |
| | 元のセッションは不変 |
| `getZoneStats()` | 空セッション → 空配列 |
| | 単一ゾーン → made/attempted 集計 |
| | 複数ゾーン → ゾーン別集計 |
| `getTotalStats()` | 空セッション → 0/0 |
| | 全ショットの made/attempted 合計 |
| `getAggregateZoneStats()` | 複数セッション横断のゾーン別集計 |
| `getAggregateTotalStats()` | 複数セッション横断の全体集計 |
| `getGroupStats()` | ゾーンスタッツをグループ別に集計 |

### 3. apps/mobile/src/features/sync/__tests__/SyncService.test.ts

SyncService の `handleIncoming` ロジックをテスト。
watchBridge はモックし、コールバック・dedup・ルーティングのみ検証。

| テストケース | 検証内容 |
|------------|---------|
| **shot 受信（Watch 発）** | onRemoteShot コールバックが zoneId, made, timestamp で呼ばれる |
| **shot 受信（iPhone 発エコー）** | source === "iphone" → コールバック呼ばれない |
| **shot 重複排除** | 同一 shotId の2回目 → コールバック呼ばれない |
| **zone-change 受信** | onRemoteZoneChange が zoneId で呼ばれる |
| **watch-ready（セッションなし）** | reply に `{hasActiveSession: false}` |
| **watch-ready（セッションあり）** | reply に `{hasActiveSession: true, sessionId, ...}` |
| **watch-ready（終了済みセッション）** | reply に `{hasActiveSession: false}` |
| **unhandled type** | コールバック呼ばれない、エラーなし |
| **sendShot** | bridge.sendRealtime が呼ばれ、shotId が dedup Set に登録 |
| **sendZoneChange** | bridge.sendContext + sendRealtime が呼ばれる |
| **sendSessionStart** | bridge.sendRealtime + sendContext、currentSession 更新 |
| **sendSessionEnd** | endedAt なし → 早期 return |
| **sendSessionEnd** | endedAt あり → bridge.sendRealtime + sendContext |
| **syncStats** | bridge.sendContext が zoneStats ペイロードで呼ばれる |
| **stop** | unsubscribers 呼び出し、dedup Set クリア |

---

## Swift テスト

### 4. targets/watch/SessionStateTests.swift

Swift Testing framework (`@Test`, `#expect`) を使用。
NotificationCenter のモックで Notification 連携もテスト。

| テストケース | 検証内容 |
|------------|---------|
| **初期状態** | isSessionActive == false, zoneCounts 空, selectedZoneId デフォルト値 |
| **recordShot（active）** | isSessionActive = true → made/attempted が正しく加算 |
| **recordShot（idle）** | isSessionActive = false → zoneCounts 変化なし |
| **recordRemoteShot** | 指定ゾーンの made/attempted が正しく加算 |
| **recordRemoteShot（新規ゾーン）** | 未登録ゾーン → 新規 ZoneCount 作成 |
| **セッション開始通知** | .sessionStartedFromiPhone → isSessionActive = true, zoneCounts クリア |
| **セッション終了通知** | .sessionEndedFromiPhone → isSessionActive = false |
| **ゾーン変更通知** | .zoneChangedFromiPhone → selectedZoneId 更新 |
| **スタッツ同期通知** | .statsUpdatedFromiPhone → zoneCounts が上書きマージ |
| **currentZone** | selectedZoneId のカウントを返す / 未登録ゾーンは 0/0 |
| **totalMade / totalAttempted** | 全ゾーン合算 |
| **totalPercentage** | 0 除算安全 / 正しいパーセント |
| **groupStats** | グループ別の集計 |

---

## テスト環境セットアップ

### TypeScript

```bash
# packages/core に Vitest 追加
pnpm -F @shoot-creater/core add -D vitest

# apps/mobile に Vitest 追加（SyncService テスト用）
pnpm -F mobile add -D vitest
```

**vitest.config.ts** を各パッケージに作成。

### Swift

`targets/watch/Tests/` ディレクトリに Swift Testing ファイルを配置。
Xcode の test target 追加は不要 — `swift test` コマンドまたは
standalone の Swift ファイルとして `xcrun swift` で実行。

※ watchOS ターゲットの XCTest は Xcode 設定が複雑なため、
SessionState のロジックテストは **依存なし standalone Swift** として実装し、
`xcrun swiftc -o test && ./test` で実行する方式を採用。

---

## ファイル構成

```
packages/core/
├── src/
│   ├── sync.ts
│   ├── sync.test.ts          ← NEW
│   ├── session.ts
│   └── session.test.ts       ← NEW
├── vitest.config.ts           ← NEW
└── package.json               ← vitest 追加

apps/mobile/
├── src/features/sync/
│   ├── SyncService.ts
│   ├── __tests__/
│   │   └── SyncService.test.ts  ← NEW
│   └── useWatchSync.ts
├── vitest.config.ts              ← NEW
└── package.json                  ← vitest 追加

apps/mobile/targets/watch/
└── Tests/
    └── SessionStateTests.swift   ← NEW
```

---

## 実行コマンド

```bash
# TypeScript テスト（全体）
pnpm -F @shoot-creater/core test
pnpm -F mobile test

# Swift テスト
cd apps/mobile/targets/watch
xcrun -sdk watchsimulator swiftc -parse-as-library Tests/SessionStateTests.swift SessionState.swift ZoneData.swift -o /tmp/session-test && /tmp/session-test
```

---

## 優先度

1. **High**: `sync.test.ts` — 重複排除はデータ整合性の要
2. **High**: `session.test.ts` — セッション操作の immutability 保証
3. **High**: `SyncService.test.ts` — 同期プロトコルの正しさ
4. **Medium**: `SessionStateTests.swift` — Watch 側のステート管理
