# ShootCreater 詳細設計仕様

---

## 1. ユビキタス言語

プロジェクト全体で統一する用語定義。コード・UI・会話すべてでこの語彙を使う。

| 用語 | 英語 (コード上) | 定義 |
|------|----------------|------|
| ウィング | `Wing` | 3PT弧とペイント横の間（ベースラインとエルボーの間） |
| セッション | `Session` | 1回のシューティング練習単位。開始〜終了（最大24h自動カット） |
| ショット | `Shot` | 1回のシュート試行 |
| メイド | `Made` | シュート成功（入った） |
| ミス | `Miss` | シュート失敗（外した） |
| ゾーン | `Zone` | コート上のシュートエリア（19分割: NBA式 + RA/ペイント左右分割 + ディープレンジ） |
| FG | `FieldGoal` | メイド数 / 試行数 |
| FG% | `fgPct` | フィールドゴール成功率 (0-100) |
| コート | `Court` | ハーフコート全体 |
| ボイスコマンド | `VoiceCommand` | 音声入力キーワード（"in" / "out"） |
| フィードバック | `Feedback` | ショット結果の音声応答（メイド→ピンポン、ミス→無音） |
| アクティブゾーン | `ActiveZone` | 現在カウント中のゾーン |
| デイリーFG | `DailyFG` | その日の全セッション合算FG |
| セッション履歴 | `SessionHistory` | 過去セッションの一覧 |
| 累計スタッツ | `AggregateStats` | 複数セッション横断の統計 |
| 制限区域 | `RestrictedArea` | ゴール下の半円エリア（RA） |
| ペイント | `Paint` | キーエリア（RA除く） |
| ミドルレンジ | `MidRange` | ペイント外〜3PTライン内 |
| スリーポイント | `ThreePoint` | 3PTライン上〜通常射程 |
| ディープレンジ | `DeepRange` | 3PTライン大幅に超えた射程（ロゴショット等） |
| アバブ・ザ・ブレイク | `AboveTheBreak` | 3PTラインのコーナー以外の弧部分 |
| コーナースリー | `CornerThree` | 3PTコーナー（ブレイク以下） |
| エルボー | `Elbow` | フリースローライン左右の角 |
| ベースライン | `Baseline` | エンドライン沿い |
| フリースロー | `FreeThrow` | フリースローライン付近 |

---

## 2. 技術的難所と突破方針

### 難所 1: 音声認識の精度と連続性

**課題**: "in"/"out" の短い単語を continuous モードで安定認識し続ける

**突破方針**:
```
┌─────────────────────────────────────────────────────────┐
│  SFSpeechRecognizer (iOS on-device)                     │
│                                                         │
│  "in"  → transcript に含まれる → Made 判定              │
│  "out" → transcript に含まれる → Miss 判定              │
│                                                         │
│  問題: continuous モードが途切れる（iOS が60秒で切る）     │
│  対策: "end" イベントで自動再起動                         │
│                                                         │
│  問題: 誤認識（"it" を "in" と認識 etc.）                │
│  対策: interimResults の最終確定結果のみ採用              │
│        + debounce 300ms で連続誤判定を防止               │
│                                                         │
│  問題: Bluetooth マイクへの切り替え                       │
│  対策: iosCategory で allowBluetooth を明示              │
└─────────────────────────────────────────────────────────┘
```

**実装ポイント**:
- `continuous: true` + `interimResults: true` で起動
- `isFinal === true` の結果のみでショット判定
- `end` イベントハンドラで即 `start()` を再呼び出し（自動再接続ループ）
- 300ms debounce で同一ショットの重複カウント防止
- `requiresOnDeviceRecognition: true` でオフライン対応

### 難所 2: フィードバック音と音声認識の共存

**課題**: 効果音再生で音声認識が中断する（AVAudioSession 競合）

**突破方針**:
```
┌──────────────────────────────────────────────────┐
│  方式: System Sound で再生（AudioSession に干渉しない）  │
│                                                    │
│  Made → AudioServicesPlaySystemSound(1057)         │
│         (Tink: 短い "ピン" 音)                       │
│                                                    │
│  Miss → 無音（何もしない）                            │
│                                                    │
│  理由: SystemSound は AVAudioSession の外で再生      │
│        → 音声認識を中断しない                         │
│        → Bluetooth HFP モードにも影響しない           │
│                                                    │
│  代替案: expo-haptics で触覚フィードバック             │
│         Made → Haptics.notificationAsync(success)   │
│         Miss → Haptics.notificationAsync(error)     │
│         → 音声一切不要で最も安全                      │
└──────────────────────────────────────────────────┘
```

**推奨**: 音声フィードバック + 触覚フィードバックの併用
- メイド → システムサウンド "ピン" + Haptics success
- ミス → 無音 + Haptics light（軽い振動のみ）

### 難所 3: セッションの24h自動カットと永続化

**課題**: 24時間を超えたセッションの自動終了、アプリ再起動後の復帰

**突破方針**:
```
┌──────────────────────────────────────────────────────┐
│  Session ライフサイクル                                  │
│                                                        │
│  作成時: startedAt = Date.now()                        │
│         expiresAt = startedAt + 24h                    │
│                                                        │
│  ショット記録時:                                        │
│    if (Date.now() > expiresAt) {                       │
│      → 現セッション自動終了                              │
│      → 新セッション自動作成                              │
│      → ショットは新セッションに記録                       │
│    }                                                   │
│                                                        │
│  アプリ再起動時:                                        │
│    AsyncStorage から最後のセッションを復元               │
│    if (未終了 && 24h以内) → 継続                        │
│    if (未終了 && 24h超過) → 自動終了 → 新セッション      │
│    if (終了済み) → 新セッション                          │
│                                                        │
│  永続化タイミング: ショット追加ごとに即座に保存            │
└──────────────────────────────────────────────────────┘
```

### 難所 4: Watch ↔ iPhone 同期の信頼性

**課題**: WatchConnectivity の通信が不安定（特に Simulator）

**突破方針**:
```
┌──────────────────────────────────────────────────────┐
│  Watch は独立動作 + ベストエフォート同期                   │
│                                                        │
│  Watch 側:                                             │
│    ・ゾーン選択とカウントは Watch ローカルで完結            │
│    ・ショットは transferUserInfo でキュー転送（確実）      │
│    ・リアルタイム補助として sendMessage も併用             │
│    ・ゾーン変更は updateApplicationContext で最新上書き    │
│    ・iPhone 不在でも Watch 単体で動作可能                 │
│                                                        │
│  iPhone 側:                                            │
│    ・音声認識でカウント（メイン入力）                      │
│    ・Watch からのショット通知を受信 → セッションに追加     │
│    ・ゾーン変更を Watch に通知                            │
│                                                        │
│  同期方針: Eventually Consistent                        │
│    ・Watch と iPhone 両方でショット記録可能               │
│    ・セッション終了時に最終集計                           │
└──────────────────────────────────────────────────────┘
```

### 難所 5: 細かいゾーン選択を Watch の小画面で実現する

**課題**: 19ゾーンを 40mm の Watch 画面で選ばせる

**突破方針**:
```
┌──────────────────────────────────────────────────────┐
│  2段階選択 UI + リアルタイムスタッツ表示                   │
│                                                        │
│  Step 1: エリア大分類（5択） — グループ集計スタッツ付き      │
│    ┌───────────────────────────────────┐               │
│    │ 🔴 INSIDE    2  ▶  (12/15 80%)  │               │
│    │ 🟠 PAINT     2  ▶  (9/18  50%)  │               │
│    │ 🟣 MID-RANGE 7  ▶  (7/20  35%)  │               │
│    │ 🔵 3-POINT   5  ▶  (5/15  33%)  │               │
│    │ 🩷 DEEP      3  ▶  (1/5   20%)  │               │
│    └───────────────────────────────────┘               │
│    ※ スタッツはデータがある場合のみ表示                    │
│    ※ 未試行グループはゾーン数のみ表示                      │
│                                                        │
│  Step 2: サブゾーン（2-7択） — 各ゾーンのスタッツ付き       │
│    ミドルレンジ選択後:                                    │
│    ┌──────────────────────────────────┐                │
│    │ LBL  Left BL       3/5  60%     │                │
│    │ LW   Left Wing     2/4  50%     │                │
│    │ LE   Left Elbow    1/3  33%     │                │
│    │ FT   Free Throw    ---          │                │
│    │ RE   Right Elbow   ---          │                │
│    │ RW   Right Wing    1/2  50%     │                │
│    │ RBL  Right BL      ---          │                │
│    │ ─────────────────────────────── │                │
│    │ Group             7/14  50%     │                │
│    └──────────────────────────────────┘                │
│    ※ 選択中ゾーンはハイライト表示                         │
│    ※ FG% に応じた色分け (緑/黄/橙/赤)                    │
│                                                        │
│  → 最大2タップでゾーン選択完了                            │
│  → 全グループが2ゾーン以上のためすべて2タップ               │
└──────────────────────────────────────────────────────┘
```

### 難所 6: AirPods Pro + iPhone のシューティング運用

**想定ユースケース**:
```
プレイヤーの状態:
  ・AirPods Pro を装着
  ・iPhone はポケットまたはコート脇（Bluetooth 圏内 ~10m）
  ・ハーフコートでシューティング練習中
  ・シュート → "in" or "out" と発声 → 自動カウント
  ・メイド時に "ピン" がイヤホンから聞こえる
```

**技術的な流れ**:
```
┌──────────────────────────────────────────────────────────┐
│                                                          │
│  AirPods Pro (Bluetooth HFP)                             │
│  ┌────────────┐        ┌────────────┐                    │
│  │ マイク入力   │───────→│ iPhone     │                    │
│  │ "in" / "out"│  BT    │ SFSpeech   │                    │
│  └────────────┘        │ Recognizer │                    │
│                        └─────┬──────┘                    │
│                              │ 認識結果                    │
│                              ▼                            │
│                        ┌────────────┐                    │
│                        │ Shot 判定   │                    │
│                        │ Made/Miss  │                    │
│                        └─────┬──────┘                    │
│                              │                            │
│                    ┌─────────┴──────────┐                │
│                    ▼                    ▼                │
│              ┌──────────┐        ┌──────────┐            │
│              │ Made     │        │ Miss     │            │
│              │ → System │        │ → 無音    │            │
│              │   Sound  │        │ → Haptics │            │
│              │   "ピン"  │        │   light  │            │
│              │ → Haptics│        └──────────┘            │
│              │   success│                                │
│              └──────────┘                                │
│                    │                                      │
│                    ▼ SystemSound は HFP 経由で再生         │
│              ┌────────────┐                               │
│              │ AirPods    │                               │
│              │ スピーカー   │                               │
│              │ "ピン" 聞こえる│                             │
│              └────────────┘                               │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

**クリアすべきポイント**:

| # | 課題 | 対策 | 確認状況 |
|---|------|------|---------|
| 1 | AirPods マイクで "in"/"out" を認識できるか | `iosCategory.categoryOptions: ["allowBluetooth"]` で Bluetooth マイクを有効化。SFSpeechRecognizer はシステムのデフォルト入力を使うため、AirPods が接続されていれば自動的にそちらを使う | expo-speech-recognition がデフォルトで対応 |
| 2 | HFP モード切り替えで音声認識精度が落ちないか | HFP のサンプルレートは 16kHz（AirPods Pro は AAC-ELD 24kHz）。"in"/"out" のような短い単語は十分な精度で認識可能。on-device 認識推奨 | 実機テスト必要 |
| 3 | フィードバック音が AirPods から聞こえるか | SystemSound (AudioServicesPlaySystemSound) は HFP 経由で AirPods に出力される。AVAudioSession を使う再生と違い、音声認識を中断しない | iOS 標準動作 |
| 4 | iPhone がポケット内で動作し続けるか | `AVAudioSession.setActive(true)` でバックグラウンドオーディオを維持。`UIBackgroundModes: ["audio"]` を Info.plist に追加 | config plugin で対応 |
| 5 | iPhone ロック中でも音声認識が続くか | バックグラウンドオーディオモードが有効なら継続。ただし iOS が省電力でプロセスを停止する可能性あり。画面ロック防止（`expo-keep-awake`）を推奨 | 要検証 |
| 6 | AirPods の着脱で音声認識が中断しないか | `end` イベントで自動再起動するループで対応。AirPods 外し → 内蔵マイクにフォールバック → AirPods 戻し → AirPods マイクに自動切り替え | 自動再起動ループで吸収 |

**追加で必要な実装**:

```typescript
// app.json に追加
{
  "expo": {
    "ios": {
      "infoPlist": {
        "UIBackgroundModes": ["audio"]  // バックグラウンドオーディオ
      }
    },
    "plugins": [
      ["expo-keep-awake"]  // 画面ロック防止
    ]
  }
}
```

```typescript
// useVoiceCounter.ts の start() に追加
ExpoSpeechRecognitionModule.start({
  lang: "en-US",
  continuous: true,
  interimResults: true,
  requiresOnDeviceRecognition: true,  // オフライン対応 + 低遅延
  iosCategory: {
    category: "playAndRecord",
    categoryOptions: ["defaultToSpeaker", "allowBluetooth"],
    mode: "measurement",
  },
});
```

```typescript
// フィードバック音 (SystemSound - 音声認識を中断しない)
import { Platform } from "react-native";
import * as Haptics from "expo-haptics";

function playMadeFeedback() {
  // SystemSound は AVAudioSession の外で再生 → 音声認識と競合しない
  if (Platform.OS === "ios") {
    // AudioServicesPlaySystemSound は Expo Module で呼ぶか
    // expo-haptics の notification で代替
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }
}

function playMissFeedback() {
  // 無音 + 軽い触覚のみ
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
}
```

---

## 3. ゾーン定義（19分割ハーフコート — NBA式 + RA/ペイント左右分割 + ディープレンジ）

NBAショットチャートの標準ゾーン分割に準拠。RA・ペイントを左右分割し、ディープレンジ（ロゴショット圏）を追加。
全19ゾーン、5大分類。ゾーン境界は3PTアークのベジェ曲線（Q コマンド）で描画。

```
  ┌─────────────────────────────────────────────────────────────┐
  │                                                             │
  │              ⑰               ⑱               ⑲            │
  │           Deep Left       Deep Center      Deep Right       │
  │                                                             │
  ╞═════════════════════════════════════════════════════════════╡ ← 強調ライン
  │ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ │ ← ハーフコート(破線)
  │                                                             │
  │  ⑫           ⑭            ⑯             ⑮           ⑬    │
  │ Corner    Above the      Above the     Above the    Corner  │
  │ 3 Left   Break Left     Break Center   Break Right  3 Right │
  │                                                             │
  │        ┌───────────────────────────────────┐                │
  │        │                                   │                │
  │   ⑤   │   ⑨           ⑪           ⑩    │    ⑥          │
  │  Left  │  Left        Free         Right  │   Right        │
  │  Base  │  Elbow      Throw        Elbow   │   Baseline     │
  │  line  │                                   │                │
  │   ⑦   │       ┌──────┬──────┐             │    ⑧          │
  │  Left  │       │  ③  │  ④  │             │   Right        │
  │  Wing  │       │ PL  │ PR  │             │   Wing         │
  │        │       │     │     │             │                │
  │        │       │  ┌──┴──┐  │             │                │
  │        │       │  │① ②│  │             │                │
  │        │       │  │RAL│RAR│  │             │                │
  │        │       │  └─────┘  │             │                │
  │        │       └───────────┘             │                │
  │        └───────────────────────────────────┘                │
  └─────────────────────────────────────────────────────────────┘
                          ↑ Basket

  #   ID                     英語名                      日本語名              大分類
  ──────────────────────────────────────────────────────────────────────────────
  ①  restricted-area-left    RA Left                     制限区域（左）        ゴール下
  ②  restricted-area-right   RA Right                    制限区域（右）        ゴール下
  ③  paint-left              Paint Left                  ペイント左           ペイント
  ④  paint-right             Paint Right                 ペイント右           ペイント
  ⑤  mid-left-baseline       Left Baseline               左ベースライン        ミドルレンジ
  ⑥  mid-right-baseline      Right Baseline              右ベースライン        ミドルレンジ
  ⑦  mid-left-wing           Left Wing                   左ウィング           ミドルレンジ
  ⑧  mid-right-wing          Right Wing                  右ウィング           ミドルレンジ
  ⑨  mid-left-elbow          Left Elbow                  左エルボー           ミドルレンジ
  ⑩  mid-right-elbow         Right Elbow                 右エルボー           ミドルレンジ
  ⑪  mid-free-throw          Free Throw                  フリースロー         ミドルレンジ
  ⑫  corner-three-left       Left Corner 3               左コーナースリー      スリーポイント
  ⑬  corner-three-right      Right Corner 3              右コーナースリー      スリーポイント
  ⑭  above-break-left        Above the Break 3 Left      ATB左               スリーポイント
  ⑮  above-break-right       Above the Break 3 Right     ATB右               スリーポイント
  ⑯  above-break-center      Above the Break 3 Center    ATBセンター          スリーポイント
  ⑰  deep-left               Deep Left                   ディープ左           ディープレンジ
  ⑱  deep-center             Deep Center                 ディープセンター      ディープレンジ
  ⑲  deep-right              Deep Right                  ディープ右           ディープレンジ
```

### ゾーングループ定義（Watch 2段階選択 / 分類集計用）

| グループID         | 表示名       | 含まれるゾーン                                            | ゾーン数 |
|-------------------|-------------|--------------------------------------------------------|---------|
| `restricted-area` | ゴール下(INSIDE) | restricted-area-left, restricted-area-right            | 2       |
| `paint`           | ペイント(PAINT)  | paint-left, paint-right                                | 2       |
| `mid-range`       | ミドルレンジ(MID) | mid-left-baseline, mid-right-baseline, mid-left-wing, mid-right-wing, mid-left-elbow, mid-right-elbow, mid-free-throw | 7 |
| `three-point`     | スリーポイント(3PT) | corner-three-left, corner-three-right, above-break-left, above-break-right, above-break-center | 5 |
| `deep`            | ディープレンジ(DEEP) | deep-left, deep-center, deep-right                   | 3       |

### ゾーン配色（FG%ヒートマップ — NBA Shot Chart準拠）

```
  FG% ≥ 55%  →  🟢 Hot   (rgba(34,197,94,0.55))    リーグ平均を大幅に上回る
  FG% ≥ 40%  →  🟡 Warm  (rgba(234,179,8,0.45))    リーグ平均前後
  FG% ≥ 25%  →  🟠 Cool  (rgba(249,115,22,0.45))   やや苦手
  FG% <  25%  →  🔴 Cold  (rgba(239,68,68,0.40))    要改善
  未試行     →  ⚫ Empty (rgba(255,255,255,0.06))  データなし
```

### NBA標準ゾーンとの対応表

```
  NBA.com Zone               → ShootCreater Zone
  ─────────────────────────────────────────────
  Restricted Area             → restricted-area-left / restricted-area-right
  In The Paint (Non-RA)       → paint-left / paint-right
  Mid-Range (Left Baseline)   → mid-left-baseline
  Mid-Range (Right Baseline)  → mid-right-baseline
  Mid-Range (Left Elbow)      → mid-left-elbow
  Mid-Range (Right Elbow)     → mid-right-elbow
  Mid-Range (Free Throw)      → mid-free-throw
  Left Corner 3               → corner-three-left
  Right Corner 3              → corner-three-right
  Above the Break 3 (Left)    → above-break-left
  Above the Break 3 (Right)   → above-break-right
  Above the Break 3 (Center)  → above-break-center
  (NBA標準にはない)            → deep-left / deep-center / deep-right
```

---

## 4. ステートマシン

### 4-1. セッション ステートマシン（iPhone 側が主管理）

```
                         ┌──────────────────────────────┐
                         │                              │
                         ▼                              │
  ┌─────────┐    開始   ┌──────────┐    ゾーン選択    ┌──────────────┐
  │  Idle    │────────→ │ Started  │───────────────→│  Recording   │
  │(待機中)  │          │(開始済み) │                  │ (カウント中)  │
  └─────────┘          └──────────┘                  └──────────────┘
       ▲                                               │    │    │
       │                                               │    │    │
       │              ┌──────────┐     一時停止         │    │    │
       │              │ Paused   │◄────────────────────┘    │    │
       │              │(一時停止) │                          │    │
       │              └──────────┘                          │    │
       │                   │   再開                          │    │
       │                   └───────────────────────────────→┘    │
       │                                                         │
       │              ┌──────────┐     終了 / 24h超過             │
       └──────────────│ Ended    │◄──────────────────────────────┘
                      │(終了)    │
                      └──────────┘

  イベント:
    START        → Idle → Started
    SELECT_ZONE  → Started → Recording
    SHOT_MADE    → Recording → Recording (カウント+1)
    SHOT_MISSED  → Recording → Recording (カウント+1)
    CHANGE_ZONE  → Recording → Recording (ゾーン切替)
    PAUSE        → Recording → Paused
    RESUME       → Paused → Recording
    END          → Recording|Paused → Ended
    EXPIRE       → Recording|Paused → Ended (24h自動)
    NEW_SESSION  → Ended → Idle
```

### 4-2. 音声認識 ステートマシン

```
  ┌──────────┐    START_VOICE   ┌────────────┐
  │  Off     │────────────────→│ Listening   │◄─────────┐
  │(停止中)  │                  │(認識待機中)  │           │
  └──────────┘                  └────────────┘           │
       ▲                            │                    │
       │                            │ 音声検知            │
       │ STOP_VOICE                 ▼                    │
       │                       ┌────────────┐            │
       │                       │ Processing │            │
       │                       │(判定処理中) │            │
       │                       └────────────┘            │
       │                         │        │              │
       │                   "in" 確定  "out" 確定          │
       │                         │        │              │
       │                         ▼        ▼              │
       │                  ┌─────────┐ ┌─────────┐        │
       │                  │ Made    │ │ Missed  │        │
       │                  │(フィード │ │(無音)   │        │
       │                  │ バック)  │ │         │        │
       │                  └────┬────┘ └────┬────┘        │
       │                       │           │              │
       │                       └─────┬─────┘              │
       │                             │ 300ms debounce 後   │
       │                             └────────────────────┘
       │
       │            ┌─────────────┐
       └────────────│ Interrupted │ (iOS が60秒で切った場合)
                    │(中断)       │
                    └─────────────┘
                         │ 自動再起動
                         └──→ Listening に戻る
```

### 4-3. Watch ステートマシン

```
  ┌──────────────┐   グループ選択(5択)   ┌───────────────┐
  │ GroupSelect  │──────────────────→│ SubZoneSelect │
  │(グループ選択) │  スタッツ付き一覧    │(サブゾーン選択) │
  │              │                    │ スタッツ付き    │
  │ INSIDE   (2) │                    │ 2-7択         │
  │ PAINT    (2) │                    └───────────────┘
  │ MID      (7) │                          │
  │ 3-POINT  (5) │                    サブゾーン確定
  │ DEEP     (3) │                          │
  └──────────────┘                         ▼
         ▲                           ┌──────────────┐
         │                           │  Counting    │
         │ ゾーン変更                   │(カウント表示)  │
         │                           │              │
         │                           │ MADE / MISS  │
         └───────────────────────────│ → カウント更新 │
                                     │ → transferUserInfo │
                                     │ → sendMessage(補助) │
                                     └──────────────┘
                                          │
                                    iPhone → Watch 同期
                                     ・ゾーン変更通知
                                     ・スタッツ更新
```

---

## 5. 画面遷移図

### 5-1. iPhone 画面遷移

```
  ┌──────────────┐
  │   Home       │
  │  スポーツ選択  │
  │              │
  │ [Basketball] │──────────────────────────────────┐
  │ [Tennis]     │ (Coming Soon)                    │
  │ [Soccer]     │ (Coming Soon)                    │
  │              │                                  │
  │ [過去セッション] ─────────┐                      │
  │ [累計スタッツ]  ─────────┐│                      │
  └──────────────┘         ││                      │
                           ││                      ▼
                           ││              ┌──────────────────┐
                           ││              │  SessionSetup    │
                           ││              │  セッション開始    │
                           ││              │                  │
                           ││              │  [コートマップ]    │
                           ││              │  ゾーンをタップ    │
                           ││              │     ↓            │
                           ││              │  [開始] ボタン    │
                           ││              └────────┬─────────┘
                           ││                       │
                           ││                       ▼
                           ││              ┌──────────────────┐
                           ││              │  ActiveSession   │
                           ││              │  カウント中        │
                           ││              │                  │
                           ││              │  [コートマップ]    │
                           ││              │  [カウンター]      │
                           ││              │  [音声パネル]      │
                           ││              │  [ゾーン変更]      │
                           ││              │  [一時停止]        │
                           ││              │  [終了]           │
                           ││              └────────┬─────────┘
                           ││                       │ 終了
                           ││                       ▼
                           ││              ┌──────────────────┐
                           ││              │  SessionSummary  │
                           ││              │  セッション結果    │
                           ││              │                  │
                           ││              │  全体FG%          │
                           ││              │  ゾーン別成績      │
                           ││              │  コートヒートマップ │
                           ││              │                  │
                           ││              │  [新規セッション]  │
                           ││              │  [ホームに戻る]   │
                           ││              └──────────────────┘
                           ││
                           │▼
                           │┌──────────────────┐
                           ││ SessionHistory   │
                           ││ セッション履歴     │
                           ││                  │
                           ││ 日付  FG%  ショット│
                           ││ 2/18  45%  20/44 │──→ SessionDetail
                           ││ 2/17  52%  30/58 │
                           ││ ...              │
                           │└──────────────────┘
                           │
                           ▼
                    ┌──────────────────┐
                    │ AggregateStats   │
                    │ 累計スタッツ       │
                    │                  │
                    │ 通算FG%           │
                    │ ゾーン別通算       │
                    │ 日別推移グラフ     │
                    │ コートヒートマップ  │
                    └──────────────────┘
```

### 5-2. Watch 画面遷移

```
  ┌──────────────────┐
  │  GroupSelect     │
  │  グループ選択(5択) │  ← グループ集計スタッツ付き
  │                  │
  │  [INSIDE    (2)] │───┐
  │  [PAINT     (2)] │───┤
  │  [MID-RANGE (7)] │───┤
  │  [3-POINT   (5)] │───┤
  │  [DEEP      (3)] │───┤
  └──────────────────┘   │
                         │ グループ選択
                         ▼
              ┌──────────────────┐
              │  SubZoneSelect   │  ← 各ゾーン m/n FG% 付き
              │  サブゾーン選択    │  ← 選択中ゾーンハイライト
              │                  │  ← グループ集計表示
              │ INSIDE(2択):     │
              │  [RAL] [RAR]     │
              │                  │
              │ PAINT(2択):      │
              │  [PL]  [PR]      │
              │                  │
              │ MID(7択):        │
              │  [LBL][LW][LE]   │
              │  [FT]            │
              │  [RE][RW][RBL]   │
              │                  │
              │ 3-POINT(5択):    │
              │  [LC3][ABL][ABC] │
              │  [ABR][RC3]      │
              │                  │
              │ DEEP(3択):       │
              │  [DL][DC][DR]    │
              └────────┬─────────┘
                       │ サブゾーン確定
                       ▼
              ┌──────────────────┐
              │  CountingView    │
              │  カウント画面      │
              │                  │
              │  [グループバッジ]  │  ← 色付きグループ名
              │  [m / n]        │  ← ゾーンFG (大きく)
              │  [FG%]          │  ← ゾーンFG%
              │  [MISS] [MADE]   │  ← タップでカウント
              │  [Total m/n]     │  ← 全体FG
              │  [Change Zone]   │  ← ゾーン変更
              └──────────────────┘
                       │
                  ゾーン変更
                       │
                       └──→ GroupSelect に戻る
```

---

## 6. 画面設計（ASCII アート）

### 6-1. iPhone: Home

```
┌────────────────────────────────┐
│  ◄ 　　　ShootCreater      　  │
├────────────────────────────────┤
│                                │
│   Select Sport                 │
│                                │
│  ┌────────────────────────┐    │
│  │  🏀 Basketball         │    │
│  │                    →   │    │
│  └────────────────────────┘    │
│                                │
│  ┌────────────────────────┐    │
│  │  🎾 Tennis             │    │
│  │              Coming Soon│   │
│  └────────────────────────┘    │
│                                │
│  ┌────────────────────────┐    │
│  │  ⚽ Soccer             │    │
│  │              Coming Soon│   │
│  └────────────────────────┘    │
│                                │
│                                │
│                                │
│ ┌────────────┐┌──────────────┐ │
│ │ 📋 History ││ 📊 Stats     │ │
│ └────────────┘└──────────────┘ │
│                                │
└────────────────────────────────┘
```

### 6-2. iPhone: SessionSetup（ゾーン選択 → 開始）

```
┌──────────────────────────────────┐
│  ◄ Back       Basketball      　 │
├──────────────────────────────────┤
│                                  │
│  Select Starting Zone            │
│                                  │
│  ┌──────────────────────────┐    │
│  │                          │    │
│  │  ⑭      ⑯       ⑮      │    │ ← ディープレンジ
│  │  DL     DC       DR     │    │
│  │ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ │    │ ← Deep境界ライン
│  │                          │    │
│  │  ⑨   ⑪    ⑬    ⑫   ⑩  │    │ ← スリーポイント
│  │  LC3  ABL  ABC  ABR  RC3│    │
│  │                          │    │
│  │     ┌────────────────┐   │    │
│  │     │                │   │    │
│  │  ④  │ ⑥    ⑧    ⑦  │ ⑤ │    │ ← ミドルレンジ
│  │  LBL│ LE   FT   RE  │RBL│    │
│  │     │                │   │    │
│  │     │  ┌──────────┐  │   │    │
│  │     │  │ ②    ③  │  │   │    │ ← ペイント
│  │     │  │ PL    PR │  │   │    │
│  │     │  │  ┌────┐  │  │   │    │
│  │     │  │  │ ①  │  │  │   │    │ ← 制限区域
│  │     │  │  │RA  │  │  │   │    │
│  │     │  │  └────┘  │  │   │    │
│  │     │  └──────────┘  │   │    │
│  │     └────────────────┘   │    │
│  │          ↑ Basket        │    │
│  └──────────────────────────┘    │
│                                  │
│  Selected: [ ATB Center (3PT) ▼] │
│                                  │
│  ┌──────────────────────────┐    │
│  │       START SESSION      │    │
│  └──────────────────────────┘    │
│                                  │
└──────────────────────────────────┘

  ゾーンタップ → 青くハイライト → Selected 表示が変わる
  ディープレンジは破線境界ラインの上部に表示
  START SESSION → ActiveSession に遷移
```

### 6-3. iPhone: ActiveSession（カウント中）

```
┌──────────────────────────────────┐
│  ■ End    ATB Center (3PT)    ⏸  │
├──────────────────────────────────┤
│                                  │
│   ┌──────────────────────────┐   │
│   │  ・      ・       ・      │   │  ← Deep (薄い)
│   │ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ │   │
│   │  ・  ・   ⑯   ・   ・    │   │  ← 3PT (⑯選択中=青)
│   │     ┌──────────────┐     │   │
│   │  ・  │ ・  ・   ・  │  ・  │  │  ← Mid
│   │     │  ┌───┬────┐  │     │   │
│   │     │  │③ │ ④ │  │     │   │  ← Paint (左右分割)
│   │     │  │ ┌─┴─┐ │  │     │   │
│   │     │  │ │①②│ │  │     │   │  ← RA (左右分割)
│   │     │  └─┴───┴─┘  │     │   │
│   │     └──────────────┘     │   │
│   └──────────────────────────┘   │
│   各ゾーンに FG% ヒートマップ配色   │
│   ⑯ = 選択中（青グロー + 枠線）    │
│                                  │
│          Zone FG                 │
│      ┌──────────────┐            │
│      │   7 / 12     │            │
│      │    58.3%     │            │
│      └──────────────┘            │
│                                  │
│     Total FG: 34/78 (43.6%)      │
│                                  │
│  ┌───────────┐ ┌──────────────┐  │
│  │           │ │              │  │
│  │   MISS    │ │     MADE     │  │
│  │   (red)   │ │    (green)   │  │
│  │           │ │              │  │
│  └───────────┘ └──────────────┘  │
│                                  │
│  ┌──────────────────────────┐    │
│  │  🎙 Voice: ON            │    │
│  │  Last: "in" → Made       │    │
│  │  Say "in" or "out"       │    │
│  └──────────────────────────┘    │
│                                  │
│  [ Change Zone ]                 │
│                                  │
└──────────────────────────────────┘

  コートマップ上で直接ゾーンタップも可
  ディープレンジは破線の上に表示
  Voice ON 中は "in"/"out" でカウント
  Made → "ピン" 音 + Haptics success
  Miss → 無音 + Haptics light
```

### 6-4. iPhone: SessionSummary（セッション結果）

```
┌────────────────────────────────┐
│            Summary             │
├────────────────────────────────┤
│                                │
│   Session Complete             │
│   2/18 14:30 - 15:45           │
│                                │
│       ┌──────────────┐         │
│       │  34 / 78     │         │
│       │   43.6%      │         │
│       │  Field Goal  │         │
│       └──────────────┘         │
│                                │
│   Zone Breakdown               │
│  ┌──────────────────────────┐  │
│  │ Restricted A  12/15  80%  │  │
│  │ Paint Left     5/10  50%  │  │
│  │ Paint Right    4/8   50%  │  │
│  │ Left Elbow     3/10  30%  │  │
│  │ Free Throw     4/8   50%  │  │
│  │ ATB Center     7/12  58%  │  │
│  │ Left Corner 3  2/12  17%  │  │
│  │ Deep Center    1/5   20%  │  │
│  └──────────────────────────┘  │
│                                │
│  ┌────────────────────────┐    │
│  │  ヒートマップ表示        │   │
│  │  (色の濃さ = FG%)       │   │
│  └────────────────────────┘    │
│                                │
│  ┌──────────┐ ┌─────────────┐  │
│  │ New      │ │  Home       │  │
│  │ Session  │ │             │  │
│  └──────────┘ └─────────────┘  │
│                                │
└────────────────────────────────┘
```

### 6-5. iPhone: SessionHistory（セッション履歴）

```
┌────────────────────────────────┐
│  ◄ Back       History      　  │
├────────────────────────────────┤
│                                │
│  Today                         │
│  ┌──────────────────────────┐  │
│  │  14:30-15:45   43.6%     │  │
│  │  34/78 shots   Basketball│  │
│  └──────────────────────────┘  │
│                                │
│  Yesterday                     │
│  ┌──────────────────────────┐  │
│  │  10:00-11:30   52.1%     │  │
│  │  37/71 shots   Basketball│  │
│  └──────────────────────────┘  │
│  ┌──────────────────────────┐  │
│  │  16:00-17:00   38.5%     │  │
│  │  20/52 shots   Basketball│  │
│  └──────────────────────────┘  │
│                                │
│  Feb 16                        │
│  ┌──────────────────────────┐  │
│  │  09:00-10:15   47.3%     │  │
│  │  44/93 shots   Basketball│  │
│  └──────────────────────────┘  │
│                                │
└────────────────────────────────┘

  各行タップ → SessionDetail（= SessionSummary と同じレイアウト）
```

### 6-6. iPhone: AggregateStats（累計スタッツ）

```
┌────────────────────────────────┐
│  ◄ Back       Stats        　  │
├────────────────────────────────┤
│                                │
│  All Time       Basketball     │
│                                │
│       ┌──────────────┐         │
│       │  135 / 293   │         │
│       │    46.1%     │         │
│       │  Career FG   │         │
│       └──────────────┘         │
│                                │
│   12 Sessions   293 Shots      │
│                                │
│  Zone Breakdown (All Sessions) │
│  ┌──────────────────────────┐  │
│  │ Restricted A  48/55  87%  │  │
│  │ Paint Left    22/40  55%  │  │
│  │ Paint Right   18/35  51%  │  │
│  │ Free Throw    12/30  40%  │  │
│  │ ATB Center    15/45  33%  │  │
│  │ Left Corner 3  8/25  32%  │  │
│  │ Deep Center    3/12  25%  │  │
│  │ ...                       │  │
│  └──────────────────────────┘  │
│                                │
│  Daily Trend                   │
│  60%│      ·                   │
│  50%│  · ·   ·   ·            │
│  40%│·         · · ·          │
│  30%│                          │
│     └──────────────────        │
│      2/10  12  14  16  18      │
│                                │
└────────────────────────────────┘
```

### 6-7. Watch: GroupSelect（グループ選択 — スタッツ付き5グループ）

```
    ┌──────────────────┐
    │  Zone            │
    │                  │
    │ ┌──────────────┐ │
    │ │🔴 INSIDE  2 ▶│ │  → SubZone (2択: RAL, RAR)
    │ │    12/15 80% │ │  ← グループ集計（データあり時のみ）
    │ └──────────────┘ │
    │ ┌──────────────┐ │
    │ │🟠 PAINT   2 ▶│ │  → SubZone (2択: PL, PR)
    │ │     9/18 50% │ │
    │ └──────────────┘ │
    │ ┌──────────────┐ │
    │ │🟣 MID     7 ▶│ │  → SubZone (7択)
    │ └──────────────┘ │
    │ ┌──────────────┐ │
    │ │🔵 3-POINT 5 ▶│ │  → SubZone (5択)
    │ └──────────────┘ │
    │ ┌──────────────┐ │
    │ │🩷 DEEP    3 ▶│ │  → SubZone (3択)
    │ └──────────────┘ │
    │                  │
    └──────────────────┘
    (スクロール可能)
```

### 6-8. Watch: SubZoneSelect（サブゾーン — スタッツ付きリスト）

```
    MID-RANGE:                      3-POINT:
    ┌──────────────────┐           ┌──────────────────┐
    │ ◀ Back  MID-RANGE│           │ ◀ Back   3-POINT │
    │                  │           │                  │
    │ LBL Left BL      │           │ LC3 L Corner     │
    │         3/5  60% │           │         2/8  25% │
    │ LW  Left Wing    │           │ ABL Above BK L   │
    │         2/4  50% │           │         ---      │
    │ LE  Left Elbow   │           │ ABC Above BK C   │
    │         1/3  33% │           │         7/12 58% │
    │ FT  Free Throw   │           │ ABR Above BK R   │
    │         ---      │           │         ---      │
    │ RE  Right Elbow  │           │ RC3 R Corner     │
    │         ---      │           │         1/5  20% │
    │ RW  Right Wing   │           │                  │
    │         1/2  50% │           │ Group  10/25 40% │
    │ RBL Right BL     │           └──────────────────┘
    │         ---      │
    │                  │           INSIDE:
    │ Group   7/14 50% │           ┌──────────────────┐
    └──────────────────┘           │ ◀ Back    INSIDE │
                                   │                  │
    PAINT:                         │ RAL RA Left      │
    ┌──────────────────┐           │         6/8  75% │
    │ ◀ Back     PAINT │           │ RAR RA Right     │
    │                  │           │         6/7  86% │
    │ PL  Paint Left   │           │                  │
    │         5/10 50% │           │ Group  12/15 80% │
    │ PR  Paint Right  │           └──────────────────┘
    │         4/8  50% │
    │                  │           DEEP:
    │ Group   9/18 50% │           ┌──────────────────┐
    └──────────────────┘           │ ◀ Back      DEEP │
                                   │                  │
                                   │ DL  Deep Left    │
                                   │         ---      │
                                   │ DC  Deep Center  │
                                   │         1/5  20% │
                                   │ DR  Deep Right   │
                                   │         ---      │
                                   │                  │
                                   │ Group   1/5  20% │
                                   └──────────────────┘

  ※ 選択中ゾーンはハイライト背景（グループ色 50%）
  ※ FG% に応じた色分け: ≥55%=緑, ≥40%=黄, ≥25%=橙, <25%=赤
  ※ 未試行ゾーンは "---" 表示
```

### 6-9. Watch: CountingView（メイン画面 — シュート中）

```
    ┌──────────────────┐
    │  RAL             │  ← ゾーン略称（ナビゲーションタイトル）
    │                  │
    │   ┌──────────┐   │
    │   │ INSIDE   │   │  ← グループバッジ（色付き）
    │   └──────────┘   │
    │                  │
    │    7 / 12        │  ← ゾーンFG (大きく)
    │     58%          │  ← ゾーンFG%
    │                  │
    │ ┌──────┐┌──────┐ │
    │ │ MISS ││ MADE │ │  ← タップでカウント
    │ │  赤  ││  緑  │ │     → transferUserInfo で iPhone に送信
    │ └──────┘└──────┘ │     → sendMessage でリアルタイム補助
    │                  │
    │ Total: 34/78     │  ← 全体FG (小さく)
    │                  │
    │ [Change Zone]    │  ← ゾーン変更 → GroupSelect に戻る
    └──────────────────┘

  Watch の UX 方針:
    ・グループバッジで現在地を色で即認識
    ・ゾーン FG を最も大きく表示（一番見たい情報）
    ・MADE/MISS ボタンは片手で押しやすいサイズ
    ・Total は控えめに下部表示
    ・Zone 変更は意図的なタップが必要（誤操作防止）
    ・シュートに集中できる最小限の情報量
```

---

## 7. ユースケース

### UC-1: セッションを開始してシュート練習する（iPhone メイン）

```
アクター: プレイヤー
前提: アプリが起動している

1. プレイヤーが Basketball を選択する
2. コートマップが表示される
3. プレイヤーがゾーンをタップして選択する
4. プレイヤーが「START SESSION」を押す
5. セッションが開始される（startedAt 記録）
6. 音声認識が自動的に ON になる
7. プレイヤーがシュートする
8. プレイヤーが "in" または "out" と発声する
9. システムが音声を認識し、ショットを記録する
   - "in" → Made +1、"ピン" 音 + 触覚フィードバック
   - "out" → Miss +1、無音 + 軽い触覚
10. カウンターが更新される
11. 7-10 を繰り返す
12. プレイヤーが別ゾーンに移動する場合:
    a. 「Change Zone」またはコートマップのゾーンをタップ
    b. アクティブゾーンが切り替わる
    c. 7-10 を繰り返す
13. プレイヤーが「End」を押す
14. SessionSummary が表示される
```

### UC-2: Watch でカウントする（Watch メイン）

```
アクター: プレイヤー（Watch 装着）
前提: Watch アプリが起動している

1. グループ選択（5択、スタッツ付き）が表示される
2. プレイヤーがグループをタップする（例: 3-POINT）
3. サブゾーン選択が表示される（例: 5択、各ゾーンFG%付き）
4. プレイヤーがサブゾーンをタップする（例: ABC）
5. CountingView が表示される
6. プレイヤーがシュートする
7. 結果に応じて MADE または MISS をタップする
8. カウントが更新される（ゾーン FG + デイリー FG）
9. ショットデータが iPhone に送信される（ベストエフォート）
10. 6-9 を繰り返す
11. ゾーンを変更する場合:
    a. 「Zone ↻」をタップ
    b. ZoneSelect に戻る
    c. 2-4 を繰り返す
```

### UC-3: セッション履歴を確認する

```
アクター: プレイヤー
前提: 過去にセッションが存在する

1. プレイヤーが Home で「History」をタップする
2. 日付順のセッション一覧が表示される
3. プレイヤーが特定のセッションをタップする
4. SessionDetail が表示される
   - 全体 FG%
   - ゾーン別成績
   - ヒートマップ
5. 戻るボタンで一覧に戻る
```

### UC-4: 累計スタッツを確認する

```
アクター: プレイヤー
前提: 過去にセッションが存在する

1. プレイヤーが Home で「Stats」をタップする
2. 全セッション横断の累計スタッツが表示される
   - 通算 FG%
   - ゾーン別通算成績
   - 日別 FG% 推移グラフ
```

### UC-5: 24h 超過で自動終了

```
アクター: システム
前提: セッションが24h以上継続している

1. プレイヤーがショットを記録する
2. システムが現在時刻と expiresAt を比較する
3. 24h を超過していた場合:
   a. 現在のセッションを自動終了（endedAt = expiresAt）
   b. 新しいセッションを自動作成
   c. 今回のショットは新セッションに記録される
   d. プレイヤーに通知（Toast: "セッションが自動更新されました"）
```

---

## 8. データモデル（実装版 — packages/core/src/types.ts 準拠）

```typescript
/** ゾーングループ大分類 */
type ZoneGroup = "restricted-area" | "paint" | "mid-range" | "three-point" | "deep";

/** コート/フィールド上のエリア定義 */
interface Zone {
  id: string;           // "restricted-area" | "paint" | ... | "deep-right"
  label: string;        // "Restricted Area" | "In The Paint" | ...
  shortLabel: string;   // "RA" | "PAINT" | ... (Court Map 表示用)
  group: ZoneGroup;     // ゾーンの大分類
  path: string;         // SVG path data
  labelX: number;       // SVG上のラベル表示X座標
  labelY: number;       // SVG上のラベル表示Y座標
}

/** スポーツごとの設定 */
interface SportConfig {
  id: string;
  name: string;
  icon: string;         // SF Symbols / MaterialIcons 名
  zones: Zone[];
  voiceCommands: {
    made: string[];     // ["in", "yes", "made", "good"]
    missed: string[];   // ["out", "no", "miss", "missed"]
  };
}

/** 1回のシュート記録 */
interface Shot {
  zoneId: string;
  made: boolean;
  timestamp: number;
}

/** 計測セッション */
interface Session {
  id: string;
  sportId: string;
  shots: Shot[];
  startedAt: number;
  endedAt: number | null;  // null = 進行中
}

/** Zone別の集計結果 */
interface ZoneStats {
  zoneId: string;
  made: number;
  attempted: number;
}

/** セッション全体の集計結果 */
interface TotalStats {
  made: number;
  attempted: number;
}

// ─── Repository Interface (Storage Layer Abstraction) ─────────

/**
 * セッション永続化のインターフェース
 * SQLite / Cloud / AsyncStorage など実装を差し替え可能
 */
interface SessionRepository {
  save(session: Session): Promise<void>;
  getById(id: string): Promise<Session | null>;
  getAll(): Promise<Session[]>;
  getByDateRange(from: number, to: number): Promise<Session[]>;
  delete(id: string): Promise<void>;
}
```
