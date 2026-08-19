// LMS版 Music Studio の「レーン/プリセット」を再現しつつ、
// ローカルComfyUI(ACE-Step / Stable Audio Open)向けにチューニングした定義。

// ace = ACE-Step v1(曲), ace15 = ACE-Step 1.5(歌が安定・推奨), sao = Stable Audio Open(SE/ループ)
export type Engine = "ace" | "ace15" | "sao";

export interface Preset {
  id: string;
  label: string; // 日本語表示名
  emoji: string;
  desc: string; // ひとこと説明
  engine: Engine; // 既定エンジン
  tags: string; // ACE/SAO に渡す英語のスタイル記述（音の土台）
  bpm: number; // 目安BPM（tagに反映）
  instrumental: boolean; // 歌なしが基本か
}

// サウンドの「起点」プリセット（独自ネーミング）。全員共通ではなく自分専用にできる。
export const PRESETS: Preset[] = [
  {
    id: "focus",
    label: "ディープワーク",
    emoji: "🎧",
    desc: "思考を邪魔しない静かなアンビエント。集中作業に。",
    engine: "ace",
    bpm: 66,
    instrumental: true,
    tags: "ambient electronic, soft evolving synth pads, gentle steady pulse, warm sub bass, minimal percussion, hypnotic, spacious, deep focus, clean warm polished production, wide stereo, instrumental",
  },
  {
    id: "lofi",
    label: "ナイトチル",
    emoji: "🌙",
    desc: "夜更けのビートとローファイの揺らぎ。迷ったらこれ。",
    engine: "ace",
    bpm: 82,
    instrumental: true,
    tags: "lo-fi hip hop, jazzy chords, mellow rhodes, vinyl crackle, boom bap drums, dusty, nostalgic, relaxed groove, instrumental",
  },
  {
    id: "cafe",
    label: "モーニングブリュー",
    emoji: "☕",
    desc: "淹れたての朝に似合う軽やかなジャズ。",
    engine: "ace",
    bpm: 95,
    instrumental: true,
    tags: "cafe jazz, smooth grand piano, brushed drums, warm upright bass, light swing, cozy, elegant, instrumental",
  },
  {
    id: "dreamspace",
    label: "ヴォイド",
    emoji: "✨",
    desc: "無重力の広がり。瞑想・入眠のための宇宙的アンビエント。",
    engine: "ace",
    bpm: 60,
    instrumental: true,
    tags: "ambient space music, ethereal shimmering pads, slow, dreamy, cosmic, weightless, no drums, deep reverb, meditative, instrumental",
  },
  {
    id: "edm",
    label: "オーバードライブ",
    emoji: "🚗",
    desc: "アドレナリン全開。運動・ドライブ・ハイテンションに。",
    engine: "ace",
    bpm: 128,
    instrumental: true,
    tags: "energetic EDM, four on the floor kick, driving supersaw synths, uplifting chords, festival, bright, punchy, instrumental",
  },
  {
    id: "bright",
    label: "サンビート",
    emoji: "🌞",
    desc: "陽だまりのような前向きアコースティックポップ。",
    engine: "ace",
    bpm: 110,
    instrumental: true,
    tags: "bright acoustic pop, ukulele, hand claps, cheerful, upbeat, sunny, feel-good, instrumental",
  },
  {
    id: "melancholy",
    label: "ブルーアワー",
    emoji: "🌧️",
    desc: "日暮れの青に沈む、シネマティックで切ない音。",
    engine: "ace",
    bpm: 72,
    instrumental: true,
    tags: "melancholic piano, emotional strings, slow, cinematic, tender, bittersweet, spacious, instrumental",
  },
  {
    id: "sfx",
    label: "テクスチャ",
    emoji: "🔔",
    desc: "短い効果音・環境音・質感づくり（Stable Audio）。",
    engine: "sao",
    bpm: 0,
    instrumental: true,
    tags: "clean sound effect, high quality, stereo",
  },
];

export function getPreset(id: string): Preset {
  return PRESETS.find((p) => p.id === id) ?? PRESETS[0];
}

// テンポ
export const TEMPOS = [
  { id: "slow", label: "ゆったり", word: "slow tempo", bpm: 70 },
  { id: "mid", label: "ふつう", word: "medium tempo", bpm: 100 },
  { id: "fast", label: "アップテンポ", word: "fast tempo, energetic", bpm: 128 },
] as const;

// 長さ（秒）
export const LENGTHS = [
  { id: "short", label: "みじかめ（約90秒）", seconds: 90 },
  { id: "normal", label: "ふつう（約150秒）", seconds: 150 },
  { id: "long", label: "ながめ（約210秒）", seconds: 210 },
] as const;

// 雰囲気（任意で足すタグ）
export const MOODS = [
  { id: "none", label: "指定なし", word: "" },
  { id: "bright", label: "明るめ", word: "bright, happy" },
  { id: "sad", label: "切なめ", word: "sad, emotional" },
  { id: "calm", label: "静かな時間", word: "calm, peaceful, quiet" },
  { id: "hype", label: "アガる", word: "energetic, uplifting, powerful" },
] as const;

export type TempoId = (typeof TEMPOS)[number]["id"];
export type LengthId = (typeof LENGTHS)[number]["id"];
export type MoodId = (typeof MOODS)[number]["id"];

// ===== フルマニュアル(Custom)用の語彙 =====

// 楽器ミキサー：レベルを英語のニュアンス語に変換して tags に埋め込む。
// level: 0=指定なし / 1=控えめ / 2=ふつう / 3=強め / 4=主役級
export interface Instrument {
  id: string;
  label: string;
  emoji: string;
  word: string; // 英語のベース語
}

export const INSTRUMENTS: Instrument[] = [
  { id: "guitar", label: "ギター", emoji: "🎸", word: "electric guitar" },
  { id: "aguitar", label: "アコギ", emoji: "🎻", word: "acoustic guitar" },
  { id: "drums", label: "ドラム", emoji: "🥁", word: "drums" },
  { id: "bass", label: "ベース", emoji: "🎚️", word: "bass" },
  { id: "piano", label: "ピアノ", emoji: "🎹", word: "piano" },
  { id: "synth", label: "シンセ", emoji: "🎛️", word: "synthesizer" },
  { id: "strings", label: "ストリングス", emoji: "🎻", word: "strings" },
  { id: "brass", label: "ブラス", emoji: "🎺", word: "brass section" },
];

export const INSTRUMENT_LEVELS = [
  "指定なし",
  "控えめ",
  "ふつう",
  "強め",
  "主役級",
] as const;

// レベル → tag 表現
export function instrumentPhrase(word: string, level: number): string | null {
  switch (level) {
    case 1:
      return `subtle ${word}`;
    case 2:
      return word;
    case 3:
      return `prominent ${word}`;
    case 4:
      return `dominant powerful ${word} taking the lead`;
    default:
      return null; // 0 = 触れない
  }
}

// ボーカル
export const VOCAL_GENDERS = [
  { id: "none", label: "なし（インスト）", word: "" },
  { id: "female", label: "女性", word: "female vocal" },
  { id: "male", label: "男性", word: "male vocal" },
  { id: "duet", label: "デュエット", word: "male and female duet vocals" },
  { id: "choir", label: "コーラス隊", word: "choir, group vocals" },
] as const;

export const VOCAL_TONES = [
  { id: "warm", label: "あたたかい", word: "warm" },
  { id: "airy", label: "透明感", word: "airy breathy" },
  { id: "powerful", label: "パワフル", word: "powerful belting" },
  { id: "raspy", label: "ハスキー", word: "raspy husky" },
  { id: "sweet", label: "甘い", word: "sweet tender" },
  { id: "deep", label: "低音", word: "deep low" },
  { id: "bright", label: "明るい", word: "bright energetic" },
  { id: "emotional", label: "エモい", word: "emotional expressive" },
  { id: "whisper", label: "ウィスパー", word: "soft whisper" },
  { id: "robotic", label: "ロボ声", word: "autotuned robotic" },
] as const;

export const VOCAL_AGES = [
  { id: "any", label: "指定なし", word: "" },
  { id: "child", label: "子ども", word: "childlike young" },
  { id: "young", label: "若い", word: "youthful" },
  { id: "mature", label: "大人っぽい", word: "mature" },
] as const;

// 言語（歌詞の発音に効く）
export const LANGUAGES = [
  { id: "auto", label: "自動", word: "" },
  { id: "ja", label: "日本語", word: "japanese" },
  { id: "en", label: "英語", word: "english" },
  { id: "ko", label: "韓国語", word: "korean" },
] as const;

// キー
export const KEYS = [
  "指定なし",
  "C major",
  "A minor",
  "G major",
  "E minor",
  "D major",
  "B minor",
  "F major",
  "D minor",
  "C minor",
] as const;

// ジャンル・スタイルのチップ（Sunoの "Styles" に相当）
export const STYLE_CHIPS = [
  "pop",
  "rock",
  "lo-fi hip hop",
  "city pop",
  "jazz",
  "R&B",
  "EDM",
  "house",
  "ballad",
  "acoustic",
  "cinematic",
  "ambient",
  "funk",
  "metal",
  "anime opening",
  "k-pop",
  "bossa nova",
  "trap",
  "orchestral",
  "synthwave",
] as const;

export interface VocalSpec {
  gender: string; // VOCAL_GENDERS id
  tones: string[]; // VOCAL_TONES ids
  age: string; // VOCAL_AGES id
  language: string; // LANGUAGES id
}

// ステム（Demucs htdemucs_6s の6分割）
export const STEMS = [
  { id: "vocals", label: "歌声", emoji: "🎤" },
  { id: "drums", label: "ドラム", emoji: "🥁" },
  { id: "bass", label: "ベース", emoji: "🎚️" },
  { id: "guitar", label: "ギター", emoji: "🎸" },
  { id: "piano", label: "ピアノ", emoji: "🎹" },
  { id: "other", label: "その他", emoji: "🎶" },
] as const;

// 曲の構成セクション（Aメロ/サビ… → ACE-Step の構造タグ）
export interface SectionType {
  id: string;
  label: string; // 日本語（作曲用語）
  short: string; // 短縮ラベル（アレンジ表示用）
  tag: string; // ACE-Step 構造タグ
  color: string;
  hint: string;
  defaultInstrumental?: boolean;
}
export const SECTION_TYPES: SectionType[] = [
  { id: "intro", label: "イントロ", short: "Intro", tag: "intro", color: "#71717a", hint: "曲の入り。歌なしが一般的。", defaultInstrumental: true },
  { id: "verse", label: "Aメロ", short: "A", tag: "verse", color: "#3b82f6", hint: "物語の始まり。落ち着いた歌い出し。" },
  { id: "prechorus", label: "Bメロ", short: "B", tag: "pre-chorus", color: "#06b6d4", hint: "サビへの助走。少し盛り上げる。" },
  { id: "chorus", label: "サビ", short: "サビ", tag: "chorus", color: "#f97316", hint: "曲の山場。一番の聴かせどころ。" },
  { id: "bridge", label: "Cメロ", short: "C", tag: "bridge", color: "#a855f7", hint: "展開・転調。曲に変化をつける。" },
  { id: "outro", label: "アウトロ", short: "Outro", tag: "outro", color: "#71717a", hint: "曲の締め。フェードや余韻。", defaultInstrumental: true },
];

// 定番の構成テンプレート
export const SONG_TEMPLATES: { id: string; label: string; desc: string; sections: string[] }[] = [
  { id: "jpop", label: "王道J-POP", desc: "イントロ〜落ちサビまでフル構成", sections: ["intro","verse","prechorus","chorus","verse","prechorus","chorus","bridge","chorus","outro"] },
  { id: "simple", label: "シンプル", desc: "Aメロ→サビの繰り返し", sections: ["intro","verse","chorus","verse","chorus","outro"] },
  { id: "ballad", label: "バラード", desc: "静かに始まり大サビへ", sections: ["intro","verse","chorus","verse","chorus","bridge","chorus","outro"] },
  { id: "loop", label: "ループBGM", desc: "歌なし・短め周回向け", sections: ["intro","verse","chorus","verse","chorus"] },
];
export function sectionById(id: string): SectionType {
  return SECTION_TYPES.find((s) => s.id === id) ?? SECTION_TYPES[0];
}
