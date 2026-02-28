# E2E テスト設計 (Maestro)

## 概要

iOS アプリの E2E テストに [Maestro](https://maestro.mobile.dev/) を使用する。
Watch アプリは Maestro 非対応のため、ユニットテスト（Swift）でカバーする。

## ローカル実行

### 前提条件

- Maestro CLI v2.1+ (`curl -Ls "https://get.maestro.mobile.dev" | bash`)
- Xcode + iOS Simulator

### 手順

```bash
# 1. シミュレータ用ビルド
xcodebuild -workspace ios/ShootCreater.xcworkspace \
  -scheme ShootCreater -configuration Release \
  -destination 'platform=iOS Simulator,name=iPhone 16' \
  build

# 2. シミュレータにインストール
xcrun simctl install booted <path-to-.app>

# 3. 全フロー実行
maestro test .maestro/

# 4. 個別フロー実行
maestro test .maestro/start_session.yaml
```

## テストフロー

| フロー | ファイル | 内容 |
|--------|----------|------|
| Start Session | `start_session.yaml` | アプリ起動 → Basketball タップ → セッション画面確認 |
| Record Shots | `record_shots.yaml` | MADE/MISS タップ → カウンター検証 |
| Undo Shot | `undo_shot.yaml` | UNDO → カウンター戻り確認 |
| End Session | `end_session.yaml` | 全フロー: 開始→記録→END→Summary→Home |
| History Check | `history_check.yaml` | セッション完了後 → History タブ確認 |
| Stats Check | `stats_check.yaml` | セッション完了後 → Stats タブ確認 |

## testID 命名規則

| Prefix | 用途 | 例 |
|--------|------|----|
| `btn-` | タップ可能なボタン | `btn-made`, `btn-undo` |
| `zone-` | ゾーン関連の表示値 | `zone-made-count`, `zone-pct` |
| `total-` | 全体統計 | `total-stats` |
| `summary-` | Summary 画面 | `summary-title`, `summary-fg-count` |
| `history-` | History タブ | `history-title`, `history-empty` |
| `stats-` | Stats タブ | `stats-title`, `stats-empty` |
| `sport-card-` | スポーツ選択カード | `sport-card-basketball` |
| `home-` | ホーム画面 | `home-title` |

## SVG ゾーン（CourtMap）

SVG ベースのコートマップのゾーンタップには `testID` が使えない。
Maestro では座標指定（`tapOn: { point: "50%,30%" }`）を使用する。

## Maestro Cloud / EAS Workflow

### EAS ビルド

```bash
# e2e プロファイルでシミュレータ向けビルド
eas build --profile e2e --platform ios
```

### Maestro Cloud

```bash
# Maestro Cloud でテスト実行
maestro cloud --api-key $MAESTRO_CLOUD_API_KEY \
  --app-file <path-to-.app> \
  .maestro/
```

### CI (EAS Workflows)

`eas-workflows/e2e.yml` で main ブランチへの push/PR 時に自動実行。

**必要な secret:**
- `MAESTRO_CLOUD_API_KEY`: Maestro Cloud の API キー

## Watch テスト

watchOS は Maestro 非対応。以下でカバー:

- `tests/watch/SessionStateTests.swift` — セッション状態管理のユニットテスト
- `src/features/sync/__tests__/SyncService.test.ts` — Watch↔iPhone 同期ロジックのテスト
