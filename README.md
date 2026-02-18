# ShootCreater

スポーツシュートカウンターアプリ。iPhone の音声認識 + Apple Watch のゾーン選択で、シュートの成功/失敗をカウント。

---

## 必要環境

| ツール | 最低バージョン | 現在のマシン | 確認コマンド |
|--------|-------------|-------------|-------------|
| **macOS** | 15 Sequoia+ | Darwin 24.6.0 | - |
| **Node.js** | 20.19.4+ | v20.19.5 | `node -v` |
| **pnpm** | 10.x | 10.29.3 | `pnpm -v` |
| **Xcode** | 16.1+ | 26.2 | `xcodebuild -version` |
| **CocoaPods** | 1.16.2+ | 1.16.2 | `pod --version` |
| **Ruby** | **3.2.0+** | **2.6.10 (要アップグレード)** | `ruby -v` |

---

## 初回セットアップ（ゼロから動くまで）

### Step 1: Ruby のアップグレード

現在のマシンはシステム Ruby 2.6 のため、`@bacons/apple-targets` と CocoaPods が正しく動作しない。

```bash
# rbenv をインストール
brew install rbenv ruby-build

# fish シェルの場合、~/.config/fish/config.fish に追加
echo 'status --is-interactive; and rbenv init - fish | source' >> ~/.config/fish/config.fish

# Ruby 3.3.0 をインストール
rbenv install 3.3.0
rbenv global 3.3.0

# ターミナルを再起動してから確認
ruby -v
# => ruby 3.3.0 以上が表示されること

# CocoaPods を新しい Ruby にインストール
gem install cocoapods
pod --version
# => 1.16.2 以上
```

### Step 2: 依存インストール

```bash
cd /Users/fusionagi/Projects/uuuux.design/shoot-creater

pnpm install
```

これで `packages/core` と `apps/mobile` の全依存が入る。

### Step 3: watchOS Simulator ランタイムのインストール

現在 watchOS ランタイムが未インストールのため、Xcode からダウンロードする。

**方法 A: Xcode GUI から**
1. Xcode を開く
2. メニュー: `Xcode` > `Settings...` (⌘,)
3. `Platforms` タブを選択
4. 左下の `+` ボタン > `watchOS` を選択
5. 最新の watchOS（11.x 等）をダウンロード（約 3-5GB、数分かかる）

**方法 B: コマンドラインから**
```bash
# 利用可能なランタイムを確認
xcodebuild -downloadAllPlatforms 2>&1 | head -20

# watchOS だけ入れる場合
xcodebuild -downloadPlatform watchOS
```

ダウンロード完了後、Watch Simulator を作成する：

```bash
# watchOS ランタイムを確認
xcrun simctl list runtimes | grep -i watch

# Watch Simulator を作成（例: Apple Watch Series 10 46mm）
xcrun simctl create "Apple Watch Series 10 (46mm)" \
  "com.apple.CoreSimulator.SimDeviceType.Apple-Watch-Series-10-46mm" \
  "com.apple.CoreSimulator.SimRuntime.watchOS-11-2"
# ↑ ランタイムのバージョン部分は実際の出力に合わせて変更

# iPhone Simulator とペアリング（Xcode が自動でやる場合もある）
# Xcode > Window > Devices and Simulators > Simulators で確認
```

### Step 4: Apple Team ID の設定

```bash
# 自分のコードサイニング証明書を確認
security find-identity -v -p codesigning
```

出力の中から個人アカウントの Team ID（10桁の英数字）を見つけて、`app.json` に設定する：

```bash
# app.json を編集
vi apps/mobile/app.json
```

```jsonc
{
  "expo": {
    "ios": {
      "appleTeamId": "XXXXXXXXXX",  // ← ここに個人の Team ID を貼る
      "bundleIdentifier": "com.shootcreater.app"
    }
  }
}
```

**注意**: kecak の会社アカウントではなく、個人アカウントの Team ID を使うこと。

### Step 5: ネイティブプロジェクト生成（prebuild）

```bash
pnpm -F mobile exec expo prebuild -p ios --clean
```

成功すると `apps/mobile/ios/` ディレクトリが生成される。中に：
- `ShootCreater.xcworkspace` — Xcode プロジェクト
- `ShootCreaterWatch/` — watchOS ターゲット（自動組み込み済み）

### Step 6: iPhone アプリをビルド&起動

```bash
# iPhone 17 Pro Simulator でビルド&起動
pnpm -F mobile ios
```

初回ビルドの流れ：
1. CocoaPods が Pod をインストール（1-2分）
2. Xcode がネイティブコードをコンパイル（3-5分）
3. iPhone Simulator が起動
4. アプリが自動インストール&起動
5. **ShootCreater のホーム画面が表示されたら成功**

ホーム画面で「Basketball」をタップ → セッション画面が開く。

---

## 日常の開発ワークフロー

### 全体の流れ

```
                ┌──────────────────────────────────────────┐
                │           開発ターミナル (常駐)            │
                │  pnpm -F mobile start                    │
                │  → Metro Dev Server が起動               │
                │  → ファイル保存するとホットリロード         │
                └─────────────────┬────────────────────────┘
                                  │
            ┌─────────────────────┼─────────────────────────┐
            ▼                     ▼                         ▼
   TypeScript を編集        Swift を編集              ネイティブ依存を変更
   (src/, packages/)       (targets/watch/)          (package.json)
            │                     │                         │
            ▼                     ▼                         ▼
   ホットリロードで即反映    Xcode で Cmd+R           prebuild --clean
                            で Watch に反映           → ios 再生成
                                                     → pnpm -F mobile ios
```

### パターン 1: TypeScript コードの編集（最もよく使う）

```bash
# ターミナル 1: Metro 開発サーバーを起動（常駐させておく）
cd /Users/fusionagi/Projects/uuuux.design/shoot-creater
pnpm -F mobile start
```

ターミナルにメニューが表示される：
```
› Press i │ open iOS simulator
› Press r │ reload app
› Press j │ open debugger
```

`i` を押すと Simulator でアプリが開く。
あとは `src/` 配下のファイルを保存するたびに**自動でホットリロード**される。

**ただし初回は先にネイティブビルドが必要**（Step 6 を済ませておくこと）。
2回目以降は `pnpm -F mobile start` → `i` だけで OK。

### パターン 2: watchOS (Swift) の編集

```bash
# 1. Xcode でプロジェクトを開く
open apps/mobile/ios/ShootCreater.xcworkspace
```

Xcode が開いたら：

```
Xcode 画面の左上: スキーム選択ドロップダウン
                 ┌──────────────────────────┐
                 │ ShootCreaterWatch        │ ← これを選ぶ
                 │ ShootCreater             │
                 └──────────────────────────┘

                 ┌──────────────────────────┐
実行先の選択:     │ Apple Watch Series 10... │ ← Watch Simulator を選ぶ
                 └──────────────────────────┘
```

1. 左のファイルツリーで `expo:targets` > `watch` を展開
2. Swift ファイルを編集
3. **Cmd+R** でビルド&Watch Simulator に起動
4. 変更は `targets/watch/` に保存される（`ios/` 外なので安全）

**iPhone + Watch 同時テストしたい場合：**
1. まず iPhone 側の ShootCreater スキームで Cmd+R
2. 次に ShootCreaterWatch スキームに切り替えて Cmd+R
3. 両方の Simulator が立ち上がり、WatchConnectivity で通信する

### パターン 3: packages/core の編集

```bash
# packages/core/src/ の TypeScript を編集
# → Metro が自動検知してホットリロード（mobile 側に即反映）

# 型チェックだけしたい場合
pnpm -F @shoot-creater/core typecheck
```

### パターン 4: ネイティブ依存パッケージの追加/変更

```bash
# 1. パッケージ追加
cd apps/mobile
pnpm add expo-haptics  # 例

# 2. ネイティブプロジェクトを再生成
pnpm -F mobile exec expo prebuild -p ios --clean

# 3. リビルド
pnpm -F mobile ios
```

`expo install` を使うと SDK 54 互換バージョンを自動選択してくれる：

```bash
cd apps/mobile
npx expo install expo-haptics
```

---

## コマンド一覧

### 日常使うもの

| コマンド | やること |
|---------|---------|
| `pnpm -F mobile start` | Metro 開発サーバー起動（ホットリロード） |
| `pnpm -F mobile ios` | iPhone Simulator にビルド&起動 |
| `pnpm -F mobile ios -- --device` | USB 接続の実機にビルド&起動 |
| `pnpm check` | Biome で lint + format チェック |
| `pnpm format` | Biome で自動フォーマット |
| `open apps/mobile/ios/ShootCreater.xcworkspace` | Xcode を開く（watchOS 開発用） |

### たまに使うもの

| コマンド | やること |
|---------|---------|
| `pnpm install` | 依存の再インストール |
| `pnpm -F mobile exec expo prebuild -p ios --clean` | ネイティブプロジェクト再生成 |
| `pnpm -F mobile typecheck` | mobile の TypeScript 型チェック |
| `pnpm -F @shoot-creater/core typecheck` | core の TypeScript 型チェック |
| `pnpm lint` | Biome lint のみ実行 |

### 実機ビルド

```bash
# 接続中のデバイス一覧を表示
xcrun xctrace list devices

# 特定のデバイスを指定してビルド
pnpm -F mobile ios -- --device "iPhone名"
```

---

## プロジェクト構成

```
shoot-creater/
├── apps/mobile/                 # Expo SDK 54 iOS アプリ
│   ├── src/
│   │   ├── app/                 # 画面 (Expo Router v6)
│   │   │   ├── _layout.tsx      #   ルートレイアウト (ナビゲーション設定)
│   │   │   ├── index.tsx        #   ホーム画面: スポーツ選択リスト
│   │   │   └── session/[sport]  #   セッション画面: カウンター+音声+統計
│   │   ├── components/          # 共通 UI 部品
│   │   │   ├── Counter.tsx      #   Made/Miss ボタン + 分子/分母表示
│   │   │   └── ZoneSelector.tsx #   ゾーン選択チップ (横スクロール)
│   │   ├── features/
│   │   │   ├── voice/           #   音声認識機能
│   │   │   │   ├── useVoiceCounter.ts  # 音声→ショット変換ロジック
│   │   │   │   └── VoicePanel.tsx      # 音声 ON/OFF ボタン UI
│   │   │   └── stats/           #   統計表示機能
│   │   │       ├── StatsView.tsx       # ゾーン別成績一覧
│   │   │       └── ZoneMap.tsx         # コートマップ (将来: SVG描画)
│   │   └── infra/               # インフラ層 (外部I/O)
│   │       ├── storage.ts       #   AsyncStorage でセッション永続化
│   │       └── watchBridge.ts   #   WatchConnectivity ブリッジ
│   ├── targets/watch/           # watchOS SwiftUI アプリ
│   │   ├── ShootCreaterWatch.swift          # @main エントリポイント
│   │   ├── ContentView.swift                # メイン画面 (ゾーン選択↔カウンター切替)
│   │   ├── ZoneMapView.swift                # ゾーン選択グリッド (7ゾーン)
│   │   ├── CounterView.swift                # Made/Miss ボタン + カウント
│   │   ├── SessionState.swift               # セッション状態 (@Published)
│   │   ├── WatchConnectivityManager.swift   # iPhone↔Watch 通信
│   │   └── expo-target.config.js            # Apple Targets 設定
│   ├── app.json                 # Expo 設定 (bundleId, plugins, permissions)
│   ├── package.json             # 依存定義
│   └── ios/                     # ← prebuild で自動生成 (.gitignore 対象)
├── packages/core/               # 共有ドメインロジック (純 TypeScript)
│   └── src/
│       ├── types.ts             # Zone, SportConfig, Shot, Session 型
│       ├── session.ts           # addShot, getZoneStats, getTotalStats
│       └── sports/
│           ├── index.ts         # 全スポーツの登録・取得
│           ├── basketball.ts    # バスケ: 7ゾーン (実装済)
│           ├── tennis.ts        # テニス: 6ゾーン (stub)
│           └── soccer.ts        # サッカー: 6ゾーン (stub)
├── biome.json                   # Lint/Format 設定
├── tsconfig.base.json           # 共通 TypeScript 設定
├── pnpm-workspace.yaml          # pnpm モノレポ定義
├── .npmrc                       # node-linker=hoisted
└── .gitignore
```

## レイヤードアーキテクチャ

```
┌──────────────────────────┐
│  Presentation            │  src/app/ (画面), src/components/ (UI部品)
├──────────────────────────┤
│  Features                │  src/features/ (voice, stats)
├──────────────────────────┤
│  Infrastructure          │  src/infra/ (storage, watchBridge)
├──────────────────────────┤
│  Domain                  │  packages/core/ (types, session, sports)
└──────────────────────────┘

依存方向: 上 → 下 のみ（Domain は何にも依存しない）
```

---

## 新しいスポーツを追加するには

1. `packages/core/src/sports/` に設定ファイルを追加

```typescript
// packages/core/src/sports/volleyball.ts
import type { SportConfig } from "../types";

export const volleyball: SportConfig = {
  id: "volleyball",
  name: "Volleyball",
  icon: "volleyball",
  zones: [
    { id: "zone1", label: "Zone 1", path: "M ..." },
  ],
  voiceCommands: {
    made: ["in", "kill", "ace"],
    missed: ["out", "error"],
  },
};
```

2. `packages/core/src/sports/index.ts` にエクスポートを追加
3. watchOS 側: `ZoneMapView.swift` にゾーン定義を追加（任意）

---

## トラブルシューティング

### prebuild が失敗する

```bash
# ios/ を消して最初からやり直す
rm -rf apps/mobile/ios
pnpm -F mobile exec expo prebuild -p ios --clean
```

### "appleTeamId is missing" と出る

`apps/mobile/app.json` の `expo.ios.appleTeamId` が未設定。Step 4 を参照。

### Pod install が失敗する

```bash
ruby -v  # 3.2+ であること。2.6 だと失敗する

# Pod キャッシュクリア
cd apps/mobile/ios
pod cache clean --all
pod install --repo-update
```

### 音声認識が動作しない

- **Expo Go では動作しない** → `pnpm -F mobile ios` でネイティブビルドすること
- iOS Simulator の音声認識は制限あり → **実機での検証を推奨**
- 権限ダイアログが出ない → Simulator リセット: `Device` > `Erase All Content and Settings...`

### Watch Simulator が表示されない

```bash
# watchOS ランタイムがインストールされているか確認
xcrun simctl list runtimes | grep -i watch

# 何も出ない → Step 3 の watchOS ランタイムインストールを実行
```

### Xcode で署名エラーが出る

1. `app.json` の `appleTeamId` が正しいか確認
2. Xcode で `ShootCreater` ターゲットを選択 → `Signing & Capabilities`
3. Team を**個人アカウント**に変更（kecak の会社アカウントではない方）
4. `ShootCreaterWatch` ターゲットも同様に個人アカウントを選択

### Metro が起動しない / モジュールが見つからない

```bash
# Metro キャッシュクリア
pnpm -F mobile start -- --reset-cache

# node_modules 再構築
rm -rf node_modules apps/mobile/node_modules packages/core/node_modules
pnpm install
```

### Watch 通信ができない (WatchConnectivity)

- Simulator 同士の通信は不安定 → **可能な限り実機で検証**
- iPhone 側のアプリが起動していないと Watch → iPhone 通信は失敗する
- `sendMessage` は両方がフォアグラウンドの場合のみ動作
- バックグラウンド同期は `updateApplicationContext` を使用（自動フォールバック済み）
