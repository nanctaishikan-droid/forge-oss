// ComfyUI API形式のワークフローを、パラメータから組み立てる。
// ノードのclass_type/入力は稼働中のComfyUI(object_info)で検証済み。

export const ACE_CKPT = "ace_step_v1_3.5b.safetensors";
export const ACE15_CKPT = "ace_step_1.5_turbo_aio.safetensors";
export const SAO_CKPT = "stable-audio-open-1.0.safetensors";
// Stable Audio Open のテキストエンコーダ（別ファイル。checkpointには含まれない）
export const SAO_T5 = "t5-base.safetensors";

export interface GenParams {
  tags: string; // 英語のスタイル記述（音の土台＋方向性）
  lyrics?: string; // 歌詞（[verse]/[chorus] 等。空ならインスト）
  lyricsStrength?: number; // 歌詞の効き（0〜1）
  seconds: number; // 生成尺
  seed: number;
  steps?: number;
  cfg?: number;
  filenamePrefix: string; // 例: "music-studio/ace"
  referenceAudioFile?: string; // ComfyUI input内のファイル名（声/音色を寄せる）
  loraName?: string; // 自分で学習した音色モデル(LoRA)
  loraStrength?: number; // 0〜1.5程度
  // ACE-Step 1.5 用（歌の安定化）
  language?: string; // "ja" / "en" / "ko" など
  bpm?: number;
  keyscale?: string; // "C major" / "A minor" / 空=指定なし
  timesignature?: string; // "2"/"3"/"4"/"6"
  cfgScale?: number; // 歌詞/スタイルへの忠実さ(1.5ー4)
  temperature?: number; // 創造性/ランダムさ(0.6ー1.2)
  topP?: number;
}

// ---- ACE-Step 1.5 turbo（歌が安定・推奨） ----
// 言語・キー・BPM・拍子を明示指定でき、日本語の歌詞も安定して歌う。turbo=8ステップで高速。
export function buildAce15Workflow(p: GenParams): Record<string, unknown> {
  const wf: Record<string, unknown> = {
    "1": {
      class_type: "CheckpointLoaderSimple",
      inputs: { ckpt_name: ACE15_CKPT },
    },
    "2": {
      class_type: "ModelSamplingAuraFlow",
      inputs: { model: ["1", 0], shift: 3.0 },
    },
    "3": {
      class_type: "TextEncodeAceStepAudio1.5",
      inputs: {
        clip: ["1", 1],
        tags: p.tags,
        lyrics: p.lyrics ?? "",
        seed: p.seed,
        bpm: p.bpm && p.bpm > 0 ? Math.round(p.bpm) : 120,
        duration: p.seconds,
        timesignature: p.timesignature || "4",
        language: p.language || "unknown",
        keyscale: p.keyscale && p.keyscale !== "指定なし" ? p.keyscale : "C major",
        generate_audio_codes: true,
        cfg_scale: p.cfgScale ?? 2.0,
        temperature: p.temperature ?? 0.85,
        top_p: p.topP ?? 0.9,
        top_k: 0,
        min_p: 0.0,
      },
    },
    "4": {
      class_type: "ConditioningZeroOut",
      inputs: { conditioning: ["3", 0] },
    },
    "5": {
      class_type: "EmptyAceStep1.5LatentAudio",
      inputs: { seconds: p.seconds, batch_size: 1 },
    },
    "6": {
      class_type: "KSampler",
      inputs: {
        model: ["2", 0],
        seed: p.seed,
        steps: p.steps ?? 8,
        cfg: p.cfg ?? 1.0,
        sampler_name: "euler",
        scheduler: "simple",
        positive: ["3", 0],
        negative: ["4", 0],
        latent_image: ["5", 0],
        denoise: 1.0,
      },
    },
    "7": {
      class_type: "VAEDecodeAudio",
      inputs: { samples: ["6", 0], vae: ["1", 2] },
    },
    "8": {
      class_type: "SaveAudioMP3",
      inputs: { audio: ["7", 0], filename_prefix: p.filenamePrefix, quality: "V0" },
    },
  };
  return wf;
}

// ---- ACE-Step（曲・歌モノもOK） ----
// referenceAudioFile を指定すると LoadAudio→VAEEncodeAudio→ReferenceTimbreAudio を挟み、
// その音源の音色・声質に寄せて生成する。
export function buildAceWorkflow(p: GenParams): Record<string, unknown> {
  const steps = p.steps ?? 50;
  const cfg = p.cfg ?? 5;

  const wf: Record<string, unknown> = {
    "1": {
      class_type: "CheckpointLoaderSimple",
      inputs: { ckpt_name: ACE_CKPT },
    },
    "2": {
      class_type: "EmptyAceStepLatentAudio",
      inputs: { seconds: p.seconds, batch_size: 1 },
    },
    "3": {
      class_type: "TextEncodeAceStepAudio",
      inputs: {
        clip: ["1", 1],
        tags: p.tags,
        lyrics: p.lyrics ?? "",
        lyrics_strength: p.lyricsStrength ?? 1.0,
      },
    },
    "4": {
      class_type: "TextEncodeAceStepAudio",
      inputs: { clip: ["1", 1], tags: "", lyrics: "", lyrics_strength: 1.0 },
    },
    "5": {
      class_type: "KSampler",
      inputs: {
        model: ["1", 0], // LoRAありなら後で差し替え
        seed: p.seed,
        steps,
        cfg,
        sampler_name: "euler",
        scheduler: "simple",
        positive: ["3", 0], // 参照音声ありなら後で差し替え
        negative: ["4", 0],
        latent_image: ["2", 0],
        denoise: 1.0,
      },
    },
    "6": {
      class_type: "VAEDecodeAudio",
      inputs: { samples: ["5", 0], vae: ["1", 2] },
    },
    "7": {
      class_type: "SaveAudioMP3",
      inputs: { audio: ["6", 0], filename_prefix: p.filenamePrefix, quality: "V0" },
    },
  };

  // 自分の音色モデル(LoRA)を適用（modelのみパッチ）
  if (p.loraName) {
    wf["20"] = {
      class_type: "LoraLoaderModelOnly",
      inputs: {
        model: ["1", 0],
        lora_name: p.loraName,
        strength_model: p.loraStrength ?? 1.0,
      },
    };
    (wf["5"] as any).inputs.model = ["20", 0];
  }

  if (p.referenceAudioFile) {
    wf["10"] = {
      class_type: "LoadAudio",
      inputs: { audio: p.referenceAudioFile },
    };
    wf["11"] = {
      class_type: "VAEEncodeAudio",
      inputs: { audio: ["10", 0], vae: ["1", 2] },
    };
    wf["12"] = {
      class_type: "ReferenceTimbreAudio",
      inputs: { conditioning: ["3", 0], latent: ["11", 0] },
    };
    // KSampler の positive を参照音色つき conditioning に差し替え
    (wf["5"] as any).inputs.positive = ["12", 0];
  }

  return wf;
}

// ---- Stable Audio Open（SE・短いループ向き） ----
export function buildStableAudioWorkflow(p: GenParams): Record<string, unknown> {
  const steps = p.steps ?? 50;
  const cfg = p.cfg ?? 4.98;
  return {
    "1": {
      class_type: "CheckpointLoaderSimple",
      inputs: { ckpt_name: SAO_CKPT },
    },
    // T5テキストエンコーダは別ファイルからロードする（checkpointにCLIPは無い）
    "9": {
      class_type: "CLIPLoader",
      inputs: { clip_name: SAO_T5, type: "stable_audio", device: "default" },
    },
    "2": {
      class_type: "EmptyLatentAudio",
      inputs: { seconds: p.seconds, batch_size: 1 },
    },
    "3": {
      class_type: "CLIPTextEncode",
      inputs: { text: p.tags, clip: ["9", 0] },
    },
    "4": {
      class_type: "CLIPTextEncode",
      inputs: { text: "", clip: ["9", 0] },
    },
    "5": {
      class_type: "ConditioningStableAudio",
      inputs: {
        positive: ["3", 0],
        negative: ["4", 0],
        seconds_start: 0.0,
        seconds_total: p.seconds,
      },
    },
    "6": {
      class_type: "KSampler",
      inputs: {
        model: ["1", 0],
        seed: p.seed,
        steps,
        cfg,
        sampler_name: "dpmpp_3m_sde_gpu",
        scheduler: "exponential",
        positive: ["5", 0],
        negative: ["5", 1],
        latent_image: ["2", 0],
        denoise: 1.0,
      },
    },
    "7": {
      class_type: "VAEDecodeAudio",
      inputs: { samples: ["6", 0], vae: ["1", 2] },
    },
    "8": {
      class_type: "SaveAudioMP3",
      inputs: { audio: ["7", 0], filename_prefix: p.filenamePrefix, quality: "V0" },
    },
  };
}

// ---- 音声2音声：既存曲を種に作り直す（リメイク/変奏）。ACE-Step v1 ----
// denoise が小さいほど原曲に近く、大きいほど大胆に変わる。
export interface RemakeParams {
  inputFile: string; // ComfyUI input 内のファイル名
  tags: string;
  lyrics?: string;
  denoise: number; // 0.2〜0.9 目安
  seed: number;
  steps?: number;
  cfg?: number;
  filenamePrefix: string;
}
export function buildRemakeWorkflow(p: RemakeParams): Record<string, unknown> {
  return {
    "1": { class_type: "CheckpointLoaderSimple", inputs: { ckpt_name: ACE_CKPT } },
    "10": { class_type: "LoadAudio", inputs: { audio: p.inputFile } },
    "11": { class_type: "VAEEncodeAudio", inputs: { audio: ["10", 0], vae: ["1", 2] } },
    "3": {
      class_type: "TextEncodeAceStepAudio",
      inputs: { clip: ["1", 1], tags: p.tags, lyrics: p.lyrics ?? "", lyrics_strength: 1.0 },
    },
    "4": {
      class_type: "TextEncodeAceStepAudio",
      inputs: { clip: ["1", 1], tags: "", lyrics: "", lyrics_strength: 1.0 },
    },
    "5": {
      class_type: "KSampler",
      inputs: {
        model: ["1", 0],
        seed: p.seed,
        steps: p.steps ?? 40,
        cfg: p.cfg ?? 5,
        sampler_name: "euler",
        scheduler: "simple",
        positive: ["3", 0],
        negative: ["4", 0],
        latent_image: ["11", 0],
        denoise: Math.max(0.1, Math.min(0.95, p.denoise)),
      },
    },
    "6": { class_type: "VAEDecodeAudio", inputs: { samples: ["5", 0], vae: ["1", 2] } },
    "7": {
      class_type: "SaveAudioMP3",
      inputs: { audio: ["6", 0], filename_prefix: p.filenamePrefix, quality: "V0" },
    },
  };
}
