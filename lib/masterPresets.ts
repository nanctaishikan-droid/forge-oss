// マスタリング・プリセットの「分かりやすい説明」レイヤー。
// 実際の数値は lib/luster/public/audio-settings.js。ここは表示用メタデータ。

export interface MeterSet {
  loudness: number; // 音圧
  punch: number; // 迫力
  clarity: number; // 明瞭さ
  warmth: number; // 温かさ
  width: number; // 広がり
}

export interface MasterPresetMeta {
  id: "natural" | "loud" | "clear";
  label: string; // 分かりやすい日本語名
  emoji: string;
  tagline: string; // いつ使う
  result: string; // こうなる（原音との違い）
  lufs: number; // 目標音圧(LUFS)。0に近いほど大きい
  meters: MeterSet; // 0〜3
}

export const MASTER_METERS = [
  { key: "loudness", label: "音圧" },
  { key: "punch", label: "迫力" },
  { key: "clarity", label: "明瞭さ" },
  { key: "warmth", label: "温かさ" },
  { key: "width", label: "広がり" },
] as const;

export const MASTER_PRESET_META: MasterPresetMeta[] = [
  {
    id: "natural",
    label: "そのまま",
    emoji: "🍃",
    tagline: "原音の雰囲気を壊したくないとき",
    result: "音色はほぼいじらず、音量だけを配信の標準(-12 LUFS)に整えます。加工感ゼロ。",
    lufs: -12,
    meters: { loudness: 2, punch: 0, clarity: 0, warmth: 0, width: 0 },
  },
  {
    id: "loud",
    label: "大きく・迫力",
    emoji: "🔊",
    tagline: "TikTok/YouTube/Reelで埋もれたくないとき",
    result:
      "いちばん大きく(-9 LUFS)、キック・アタックを前に出して温かみも足します。ガツンと迫力重視。",
    lufs: -9,
    meters: { loudness: 3, punch: 3, clarity: 1, warmth: 2, width: 1 },
  },
  {
    id: "clear",
    label: "クリア・繊細",
    emoji: "💎",
    tagline: "歌モノ・アコースティックを上品に聴かせたいとき",
    result:
      "高域の抜け・空気感・左右の広がりを強調。音圧は控えめ(-13 LUFS)でダイナミクスを残す。",
    lufs: -13,
    meters: { loudness: 1, punch: 1, clarity: 3, warmth: 0, width: 2 },
  },
];

// ===== カスタム・マスタリング（手動） =====
// 0〜100（LUFSのみ -14〜-8）。上げるとどうなるかを一言で。
export interface MasterSlider {
  key: string;
  label: string;
  hint: string; // 上げるとどうなる
  min: number;
  max: number;
  step: number;
  default: number;
}

export const MASTER_SLIDERS: MasterSlider[] = [
  { key: "warmth", label: "温かさ", hint: "上げると低〜中域が厚く、あたたかい音に", min: 0, max: 100, step: 1, default: 0 },
  { key: "clarity", label: "明瞭さ", hint: "上げると輪郭がはっきり、モコモコが抜ける", min: 0, max: 100, step: 1, default: 0 },
  { key: "air", label: "空気感", hint: "上げると高域のきらめき・抜けが増える", min: 0, max: 100, step: 1, default: 0 },
  { key: "punch", label: "迫力", hint: "上げるとアタック・圧が強くなる", min: 0, max: 100, step: 1, default: 0 },
  { key: "width", label: "広がり", hint: "上げると左右に広がる（モノ音源には無効）", min: 0, max: 100, step: 1, default: 0 },
  { key: "targetLufs", label: "目標音圧(LUFS)", hint: "大きいほど音がデカい。配信は -9〜-11 目安", min: -14, max: -8, step: 1, default: -12 },
];

// カスタムのデフォルト設定（全部ニュートラル＝そのまま）
export function defaultCustomSettings(): Record<string, number> {
  const s: Record<string, number> = {
    focus: 48,
    warmth: 0,
    clarity: 0,
    air: 0,
    punch: 0,
    width: 0,
    drive: 0,
    eqBass: 0,
    eqLowMid: 0,
    eqMid: 0,
    eqPresence: 0,
    eqAir: 0,
    targetLufs: -12,
    truePeak: -1,
  };
  return s;
}
