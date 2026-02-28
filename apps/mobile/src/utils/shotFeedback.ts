import { Audio } from "expo-av";
import * as Haptics from "expo-haptics";

// biome-ignore lint/style/noNonNullAssertion: require returns module
const madeAsset = require("@/assets/sounds/made.wav")!;
// biome-ignore lint/style/noNonNullAssertion: require returns module
const missAsset = require("@/assets/sounds/miss.wav")!;

let madeSound: Audio.Sound | null = null;
let missSound: Audio.Sound | null = null;

/** プリロード — セッション開始時に呼ぶ */
export async function preloadShotSounds(): Promise<void> {
  try {
    const [m, x] = await Promise.all([
      Audio.Sound.createAsync(madeAsset),
      Audio.Sound.createAsync(missAsset),
    ]);
    madeSound = m.sound;
    missSound = x.sound;
  } catch {
    // サウンド読み込み失敗は致命的でない — 触覚のみにフォールバック
  }
}

/** アンロード — セッション終了時に呼ぶ */
export async function unloadShotSounds(): Promise<void> {
  await Promise.all([
    madeSound?.unloadAsync().catch(() => {}),
    missSound?.unloadAsync().catch(() => {}),
  ]);
  madeSound = null;
  missSound = null;
}

/** MADE: 高音ビープ "ピン" + 触覚 success */
export function playMadeFeedback(): void {
  void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  void madeSound?.replayAsync().catch(() => {});
}

/** MISS: 低音ビープ2連 "ぶぶっ" + 触覚 error */
export function playMissFeedback(): void {
  void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
  void missSound?.replayAsync().catch(() => {});
}
