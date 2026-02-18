# ShootCreater 手動セットアップ手順

自動セットアップ済みの状態から、実機/Simulator で動かすまでの手順。

---

## Apple Developer Account は必要？

| やりたいこと | 必要なもの |
|------------|----------|
| **Simulator で開発** | **何もいらない**（Xcode だけ） |
| **実機で開発** | 無料の Apple ID を Xcode に登録するだけ |
| **App Store 公開** | 有料 Apple Developer Program（年 $99） |

**→ Simulator 開発なら Team ID 設定は後回しで OK。**

---

## 現在の状態

- [x] pnpm install 完了
- [x] Biome lint/format パス
- [x] TypeScript 型チェック パス
- [x] `expo prebuild -p ios --clean` 成功（`ios/` 生成済み）
- [x] watchOS ターゲット Xcode プロジェクトに組み込み済み
- [x] git 初期化済み（未コミット）
- [ ] watchOS Simulator ランタイム未インストール
- [ ] 初回ビルド未実施

---

## 1. watchOS Simulator ランタイムをインストールする

現在 watchOS ランタイムが入っていないため、Xcode からダウンロードする。
**iPhone Simulator だけで先に試したい場合はスキップ可。**

### 1-1. Xcode GUI から（推奨）

1. Xcode を開く
2. `Xcode` > `Settings...` (⌘,)
3. `Platforms` タブ
4. 左下の `+` > `watchOS` を選択
5. 最新版をダウンロード（3-5GB、5-10分程度）

### 1-2. コマンドラインから

```bash
xcodebuild -downloadPlatform watchOS
```

### 1-3. インストール確認

```bash
xcrun simctl list runtimes | grep -i watch
# => com.apple.CoreSimulator.SimRuntime.watchOS-XX-X のような行が出れば OK
```

---

## 2. iPhone アプリを Simulator でビルド&起動する

maestro の e2e が終わってから実行すること。

```bash
cd /Users/fusionagi/Projects/uuuux.design/shoot-creater

# iPhone 17 Pro Simulator にビルド&起動（Team ID 不要）
pnpm -F mobile ios
```

初回ビルドの流れ：
1. Xcode がネイティブコードをコンパイル（3-5分）
2. iPhone Simulator が起動
3. アプリが自動インストール&起動
4. **ホーム画面が出たら成功**

### 動作確認チェックリスト

- [ ] ホーム画面に「Basketball」が表示される
- [ ] 「Basketball」タップでセッション画面に遷移する
- [ ] ゾーン選択チップが横スクロールで表示される
- [ ] 「MADE」ボタンで分子/分母がカウントアップする（例: 1/1）
- [ ] 「MISS」ボタンで分母のみカウントアップする（例: 1/2）
- [ ] Stats by Zone に成績が表示される

### 音声認識の確認（実機推奨）

Simulator では音声認識が制限されるため、実機を推奨。
実機テストには無料 Apple ID の Xcode 登録が必要（Step 4 参照）。

---

## 3. watchOS アプリを Simulator でビルド&起動する

Step 1 の watchOS ランタイムインストールが完了していること。

### 3-1. Xcode でプロジェクトを開く

```bash
open apps/mobile/ios/ShootCreater.xcworkspace
```

### 3-2. Watch Simulator を準備する

Xcode の上部バーで：

```
┌─ スキーム ──────────────┐  ┌─ 実行先 ──────────────────────┐
│ ShootCreaterWatch  ▼   │  │ Apple Watch Series 10 (46mm) ▼│
└────────────────────────┘  └──────────────────────────────┘
```

1. スキームを `ShootCreaterWatch` に変更
2. 実行先で Apple Watch Simulator を選択
   - 表示されない場合は Step 1 の watchOS ランタイムインストールを確認

### 3-3. 署名の設定（Simulator の場合）

Simulator ビルドの場合、署名は自動で通ることが多い。
もし署名エラーが出たら：

1. Xcode 左のツリーで `ShootCreater` プロジェクト（青いアイコン）をクリック
2. `ShootCreaterWatch` ターゲットを選択
3. `Signing & Capabilities` タブ
4. 「Automatically manage signing」にチェック
5. Team を「None」のままでも Simulator なら動く
   - 動かない場合は個人 Apple ID でサインイン（無料で可）

### 3-4. ビルド&起動

`Cmd + R` を押す。

Watch Simulator が起動し、ゾーン選択グリッドが表示される。

### 動作確認チェックリスト

- [ ] Watch Simulator にゾーン選択グリッド（7ゾーン）が表示される
- [ ] ゾーンをタップするとカウンター画面に遷移する
- [ ] 「MADE」「MISS」ボタンが表示される
- [ ] ボタンタップで分子/分母がカウントアップする
- [ ] 「Change Zone」でゾーン選択に戻れる

---

## 4. 実機でテストしたくなったら（後回し OK）

### 4-1. 無料 Apple ID を Xcode に登録

1. Xcode > `Settings...` (⌘,) > `Accounts` タブ
2. 左下の `+` > `Apple ID`
3. 個人の Apple ID でサインイン（kecak ではない方）
4. これだけで実機ビルドが可能になる（無料、Developer Program 不要）

### 4-2. app.json に Team ID を設定

```bash
# サインイン後、Team ID を確認
security find-identity -v -p codesigning
# 出力のカッコ内 10桁英数字が Team ID
```

`apps/mobile/app.json`:
```json
{
  "expo": {
    "ios": {
      "appleTeamId": "XXXXXXXXXX",
      "bundleIdentifier": "com.shootcreater.app"
    }
  }
}
```

### 4-3. prebuild して実機ビルド

```bash
pnpm -F mobile exec expo prebuild -p ios --clean
pnpm -F mobile ios -- --device
```

### 4-4. 実機での音声認識テスト

- [ ] 「START VOICE」ボタンで権限ダイアログが出る
- [ ] 許可後、"in" と言うと MADE がカウントアップする
- [ ] "out" と言うと MISS がカウントアップする

---

## 5. iPhone + Watch 連携テスト（任意）

iPhone と Watch の双方向通信をテストする。

### 5-1. 両方の Simulator を起動

Xcode で：
1. スキームを `ShootCreater` に変更 → `Cmd + R` で iPhone 起動
2. スキームを `ShootCreaterWatch` に変更 → `Cmd + R` で Watch 起動

### 5-2. 確認事項

- [ ] Watch でショット記録 → iPhone 側にも反映される
- [ ] iPhone でショット記録 → Watch 側にも反映される

**注意**: Simulator 間の WatchConnectivity は不安定な場合がある。本格テストは実機ペアで行うこと。

---

## 6. 初回コミット（動作確認できたら）

```bash
cd /Users/fusionagi/Projects/uuuux.design/shoot-creater

git add -A
git commit -m "feat: initial ShootCreater project

- Expo SDK 54 + React Native 0.81 (New Architecture)
- watchOS SwiftUI companion app via @bacons/apple-targets
- Basketball shoot counter with 7 half-court zones
- Voice recognition (in/out) for hands-free counting
- Layered architecture: Domain → Infra → Features → Presentation
- pnpm monorepo (packages/core + apps/mobile)
- Biome lint/format
- Tennis/Soccer sport configs as stubs"
```

---

## クイックリファレンス（セットアップ完了後の日常コマンド）

```bash
# 開発サーバー起動（ホットリロード）
pnpm -F mobile start

# iPhone Simulator ビルド
pnpm -F mobile ios

# 実機ビルド（Apple ID 登録 + Team ID 設定後）
pnpm -F mobile ios -- --device

# Xcode で watchOS 開発
open apps/mobile/ios/ShootCreater.xcworkspace

# lint チェック
pnpm check

# 自動フォーマット
pnpm format
```

---

## いつ何が必要になるかのまとめ

```
Simulator 開発 ← 今すぐできる（何も追加不要）
      │
      ├─ iPhone Simulator → pnpm -F mobile ios
      └─ Watch Simulator  → Xcode + watchOS ランタイム DL

実機テスト ← Apple ID を Xcode に登録（無料）
      │
      ├─ iPhone 実機 → Team ID 設定 + pnpm -F mobile ios -- --device
      └─ Watch 実機  → iPhone と Watch ペア + Xcode から直接ビルド

App Store 公開 ← Apple Developer Program（年 $99）
      │
      └─ ここで初めて有料が必要
```
