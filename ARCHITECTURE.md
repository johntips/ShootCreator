# ShootCreater - Architecture Design Document

## Overview

スポーツシュートカウンターアプリ。Apple Watch でエリア選択 → カウント表示、iPhone で音声認識（"in"/"out"）→ カウントアップ。
バスケットボールを初期実装とし、テニス・サッカー等に汎用展開可能なレイヤードアーキテクチャ。

## Tech Stack

| Layer | Tech |
|-------|------|
| Runtime | Expo SDK 54 (React Native 0.81, React 19.1, New Architecture) |
| watchOS | SwiftUI native via `@bacons/apple-targets` v4.0.3 |
| Watch通信 | `react-native-watch-connectivity` (将来: カスタム Expo Module 移行パス) |
| 音声認識 | `expo-speech-recognition` v3.x (旧 @jamsch/expo-speech-recognition) |
| Storage | `@react-native-async-storage/async-storage` |
| Monorepo | pnpm workspaces (isolated deps - SDK 54 ネイティブ対応) |
| Lint/Format | Biome |
| 言語 | TypeScript ~5.9 (strict) |

## Business Model (将来計画)

同一アプリ内でのティア分離方式（iOS正道パターン）。

```
ShootCreater (1アプリ)
├── Free tier     → 基本カウンター（バスケ1スポーツ、セッション3件まで）
├── Pro (買い切り) → 部活生向け、全スポーツ、オフライン完結、無制限セッション
└── Cloud (月額)   → AI分析、クラウド同期、チーム共有（将来実装）
```

初期実装: ティア判定スタブのみ。全機能ローカル動作。

## Monorepo Structure

```
shoot-creater/
├── apps/
│   └── mobile/                    # Expo SDK 54 iOS app
│       ├── app.json
│       ├── src/
│       │   ├── app/               # Expo Router v6 screens
│       │   │   ├── _layout.tsx
│       │   │   ├── index.tsx      # Home: スポーツ選択
│       │   │   └── session/
│       │   │       └── [sport].tsx # 計測セッション画面
│       │   ├── features/
│       │   │   ├── voice/         # 音声認識 feature
│       │   │   │   ├── useVoiceCounter.ts
│       │   │   │   └── VoicePanel.tsx
│       │   │   └── stats/         # 統計表示 feature
│       │   │       ├── StatsView.tsx
│       │   │       └── ZoneMap.tsx
│       │   ├── infra/             # Infrastructure layer
│       │   │   ├── storage.ts     # AsyncStorage wrapper
│       │   │   └── watchBridge.ts # Watch通信
│       │   └── components/        # 共通UIコンポーネント
│       │       ├── Counter.tsx
│       │       └── ZoneSelector.tsx
│       ├── targets/
│       │   └── watch/             # watchOS SwiftUI app
│       │       ├── expo-target.config.js
│       │       ├── ShootCreaterWatch.swift
│       │       ├── ContentView.swift
│       │       ├── ZoneMapView.swift
│       │       ├── CounterView.swift
│       │       ├── WatchConnectivityManager.swift
│       │       └── Assets.xcassets/
│       ├── tsconfig.json
│       └── package.json
├── packages/
│   └── core/                      # 共有ドメインロジック (TS)
│       ├── src/
│       │   ├── index.ts
│       │   ├── types.ts           # Sport, Zone, Session 型定義
│       │   ├── sports/            # スポーツ定義
│       │   │   ├── index.ts
│       │   │   ├── basketball.ts
│       │   │   ├── tennis.ts      # stub
│       │   │   └── soccer.ts      # stub
│       │   └── session.ts         # セッション集計ロジック
│       ├── tsconfig.json
│       └── package.json
├── pnpm-workspace.yaml
├── package.json                   # root scripts
├── biome.json
├── tsconfig.base.json
└── ARCHITECTURE.md
```

## Layered Architecture

```
┌─────────────────────────────────┐
│  Presentation (screens, UI)     │  apps/mobile/src/app/, components/
├─────────────────────────────────┤
│  Features (use cases)           │  apps/mobile/src/features/
├─────────────────────────────────┤
│  Infrastructure (I/O adapters)  │  apps/mobile/src/infra/
├─────────────────────────────────┤
│  Domain (types, rules, config)  │  packages/core/
└─────────────────────────────────┘
```

### Domain Layer (`packages/core`)

スポーツに依存しない汎用型と、各スポーツの Zone/VoiceCommand 定義。

```typescript
// types.ts
export interface Zone {
  id: string;
  label: string;
  path: string; // SVG path for rendering
}

export interface SportConfig {
  id: string;
  name: string;
  zones: Zone[];
  voiceCommands: { made: string[]; missed: string[] };
}

export interface Shot {
  zoneId: string;
  made: boolean;
  timestamp: number;
}

export interface Session {
  id: string;
  sportId: string;
  shots: Shot[];
  createdAt: number;
}
```

### Feature Layer

- **useVoiceCounter**: 音声認識を起動し "in"/"out" で Shot を追加
- **StatsView**: Zone 別の made/attempted 集計表示

### Infrastructure Layer

- **storage.ts**: AsyncStorage での Session 永続化
- **watchBridge.ts**: WatchConnectivity で選択 Zone の送受信

## watchOS App (SwiftUI)

Watch 側はネイティブ SwiftUI。ハーフコートの Zone をタップ → made/attempted 表示。
iPhone との通信は WatchConnectivity で双方向。

### 画面構成

1. **ZoneMapView**: ハーフコート描画 → Zone タップ
2. **CounterView**: 選択 Zone の made / attempted 表示 + 手動 +/- ボタン

### WatchConnectivity 通信パターン

| メソッド | 用途 | リアルタイム | バックグラウンド |
|---------|------|-------------|----------------|
| `sendMessage` | ショット即時同期 | 必須 | 不可 |
| `updateApplicationContext` | セッション状態同期 | 不要 | 対応 |

## Voice Recognition Flow (iPhone)

```
[Start Session] → [音声認識 ON (continuous, ja-JP / en-US)]
     ↓
"in" detected  → Shot { zoneId: selectedZone, made: true }
"out" detected → Shot { zoneId: selectedZone, made: false }
     ↓
[Counter 更新] → [Watch に sync via WatchConnectivity]
```

## Generalization Strategy

新しいスポーツ追加:
1. `packages/core/src/sports/` に SportConfig 追加
2. Zone の SVG path を定義
3. voiceCommands をカスタマイズ（任意）
4. watchOS 側に Zone 描画を追加（SwiftUI Shape）

## Build & Development

```bash
pnpm install                         # 依存インストール
pnpm -F mobile exec expo start       # 開発サーバー起動
pnpm -F mobile exec expo prebuild -p ios --clean  # ネイティブ生成
pnpm -F mobile exec expo run:ios     # 実機ビルド
pnpm lint                            # Biome lint
pnpm check                           # Biome check (lint + format)
```

## Signing (Personal Account)

- `app.json` の `ios.appleTeamId` に個人 Team ID を設定
- watchOS target も同一 Team ID で署名
- Xcode の会社用(kecak)ではなく個人アカウントを使用
