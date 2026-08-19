// 「生成を開始する」中核ロジック。APIルートとスケジューラの両方から呼ぶ。
import { submitPrompt } from "./comfy";
import {
  buildAceWorkflow,
  buildAce15Workflow,
  buildStableAudioWorkflow,
  type GenParams,
} from "./workflows";
import {
  getPreset,
  INSTRUMENTS,
  instrumentPhrase,
  VOCAL_GENDERS,
  VOCAL_TONES,
  VOCAL_AGES,
  LANGUAGES,
  type Engine,
  type VocalSpec,
} from "./presets";
import { addJob, type Job } from "./store";

export interface GenerateInput {
  mode?: "simple" | "custom";
  presetId?: string; // simpleモード or 出発点のスタイル
  engine?: Engine; // 省略時はプリセット既定 or ace
  title?: string;

  // 共通
  description?: string; // 自由記述（英語推奨）
  styleTags?: string; // ジャンル/スタイルのタグ（カンマ区切り）
  seconds?: number;
  seed?: number;
  steps?: number;
  cfg?: number;
  auto?: boolean;

  // 歌
  instrumental?: boolean;
  lyrics?: string;
  lyricsStrength?: number;
  vocal?: VocalSpec;

  // 楽器ミキサー（id -> level 0..4）
  instruments?: Record<string, number>;

  // 音楽理論
  bpm?: number;
  key?: string; // "指定なし" or "C major" など

  // 声/音色を寄せる参照音声（ComfyUI input内のファイル名）
  referenceAudioFile?: string;

  // 自分で学習した音色モデル(LoRA)
  loraName?: string;
  loraStrength?: number;

  // エキスパート設定
  cfgScale?: number;
  temperature?: number;
  topP?: number;
}

export function makeSeed(): number {
  return Math.floor(Math.random() * 2 ** 31);
}

// ボーカル指定 → tag片
function vocalTags(v?: VocalSpec, instrumental?: boolean): string[] {
  if (instrumental) return ["instrumental", "no vocals"];
  if (!v) return [];
  const parts: string[] = [];
  const g = VOCAL_GENDERS.find((x) => x.id === v.gender);
  if (g && g.word) parts.push(g.word);
  else if (v.gender === "none") return ["instrumental", "no vocals"];
  const age = VOCAL_AGES.find((x) => x.id === v.age);
  if (age && age.word) parts.push(age.word);
  for (const tid of v.tones || []) {
    const t = VOCAL_TONES.find((x) => x.id === tid);
    if (t) parts.push(t.word);
  }
  const lang = LANGUAGES.find((x) => x.id === v.language);
  if (lang && lang.word) parts.push(`${lang.word} lyrics`);
  // 声質の説明をまとめて "... voice" に寄せる
  return parts;
}

// 楽器ミキサー → tag片
function instrumentTags(mix?: Record<string, number>): string[] {
  if (!mix) return [];
  const parts: string[] = [];
  for (const inst of INSTRUMENTS) {
    const lvl = mix[inst.id] ?? 0;
    const phrase = instrumentPhrase(inst.word, lvl);
    if (phrase) parts.push(phrase);
  }
  return parts;
}

// すべての制御を1本の英語tagsに合成
export function composeTags(input: GenerateInput): string {
  const parts: string[] = [];

  // 出発点プリセット（simpleや、customでベースを選んだ場合）
  if (input.presetId && input.mode !== "custom") {
    parts.push(getPreset(input.presetId).tags);
  } else if (input.presetId && input.mode === "custom") {
    // customではプリセットはヒント程度に短く
    parts.push(getPreset(input.presetId).id);
  }

  if (input.styleTags && input.styleTags.trim()) parts.push(input.styleTags.trim());
  parts.push(...vocalTags(input.vocal, input.instrumental));
  parts.push(...instrumentTags(input.instruments));

  if (input.bpm && input.bpm > 0) parts.push(`${input.bpm} bpm`);
  if (input.key && input.key !== "指定なし") parts.push(`key of ${input.key}`);

  if (input.description && input.description.trim()) parts.push(input.description.trim());

  // 重複除去して整形
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of parts.join(", ").split(",")) {
    const t = raw.trim();
    if (t && !seen.has(t.toLowerCase())) {
      seen.add(t.toLowerCase());
      out.push(t);
    }
  }
  return out.join(", ");
}

// 歌詞/説明から言語を推定（ACE-Step 1.5 用）
function resolveLanguage(input: GenerateInput): string {
  const v = input.vocal?.language;
  if (v === "ja" || v === "en" || v === "ko") return v;
  const text = `${input.lyrics || ""}${input.description || ""}`;
  // ひらがな/カタカナ/漢字を含めば日本語
  return /[぀-ヿ一-龯]/.test(text) ? "ja" : "unknown";
}

export async function startGeneration(input: GenerateInput): Promise<Job> {
  // 既定エンジン: SEはsao、それ以外の曲は歌が安定する ACE-Step 1.5
  const presetEngine = input.presetId ? getPreset(input.presetId).engine : "ace15";
  const engine: Engine =
    input.engine ?? (presetEngine === "sao" ? "sao" : "ace15");
  const seconds = input.seconds ?? (engine === "sao" ? 30 : 150);
  const seed = input.seed ?? makeSeed();
  const tags = composeTags(input);
  const instrumental = input.instrumental || input.vocal?.gender === "none";
  const lyrics = instrumental ? "" : input.lyrics?.trim() || "";

  const prefix =
    engine === "sao"
      ? "music-studio/sao"
      : engine === "ace15"
      ? "music-studio/ace15"
      : "music-studio/ace";

  const params: GenParams = {
    tags,
    lyrics,
    lyricsStrength: input.lyricsStrength,
    seconds,
    seed,
    steps: input.steps,
    cfg: input.cfg,
    filenamePrefix: prefix,
    // 参照音声/LoRA は v1 の構成のみ対応
    referenceAudioFile: engine === "ace" ? input.referenceAudioFile : undefined,
    loraName: engine === "ace" ? input.loraName : undefined,
    loraStrength: input.loraStrength,
    // ACE-Step 1.5 用
    language: resolveLanguage(input),
    bpm: input.bpm,
    keyscale: input.key,
    timesignature: "4",
    cfgScale: input.cfgScale,
    temperature: input.temperature,
    topP: input.topP,
  };

  const workflow =
    engine === "ace15"
      ? buildAce15Workflow(params)
      : engine === "ace"
      ? buildAceWorkflow(params)
      : buildStableAudioWorkflow(params);

  const promptId = await submitPrompt(workflow);

  const now = Date.now();
  const defaultTitle =
    input.title?.trim() ||
    (input.styleTags?.split(",")[0]?.trim()) ||
    (input.presetId ? getPreset(input.presetId).label : "無題の曲");

  const job: Job = {
    id: promptId,
    status: "QUEUED",
    engine,
    presetId: input.presetId || "custom",
    title: defaultTitle,
    tags,
    lyrics,
    seconds,
    seed,
    createdAt: now,
    updatedAt: now,
    auto: !!input.auto,
    hasVocals: !instrumental && !!lyrics,
    reference: !!input.referenceAudioFile,
  };
  addJob(job);
  return job;
}
