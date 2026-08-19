// Luster マスタリングエンジンの薄いラッパー（型付け＋パス解決）。
// 生成済み音源(mp3)を入力に、48kHz/24bit WAV を書き出す。
import fs from "node:fs";
import path from "node:path";
// @ts-ignore -- プレーンESMモジュール（型宣言なし）
import * as luster from "@/lib/luster/mastering.mjs";

const COMFY_OUTPUT =
  process.env.COMFY_OUTPUT ||
  "C:\\Users\\YOUR_NAME\\ComfyUI_windows_portable\\ComfyUI\\output";

export const MASTER_PRESETS = luster.PRESETS as Record<
  string,
  Record<string, number>
>;

export interface MasterResult {
  masteredFilename: string; // 例: music-studio/mastered/ace_00003_master.wav
  targetLufs: number;
  measuredLufs: number;
  normalization: string;
}

// inputRel: output配下の相対パス（例 "music-studio/ace_00003.mp3"）
export async function masterTrack(
  inputRel: string,
  settings?: Record<string, number>,
  presetName?: string
): Promise<MasterResult> {
  const base = path.resolve(COMFY_OUTPUT);
  const inputPath = path.resolve(base, inputRel);
  if (!inputPath.startsWith(base)) throw new Error("不正な入力パス");
  if (!fs.existsSync(inputPath)) throw new Error("元の音源が見つかりません");

  const masteredDir = path.join(base, "music-studio", "mastered");
  if (!fs.existsSync(masteredDir)) fs.mkdirSync(masteredDir, { recursive: true });

  const stem = path.basename(inputPath, path.extname(inputPath));
  const outName = `${stem}_master.wav`;
  const wavPath = path.join(masteredDir, outName);

  // 設定：明示 > プリセット > natural
  const chosen =
    settings ??
    (presetName && MASTER_PRESETS[presetName]) ??
    MASTER_PRESETS.natural;

  const meta = await luster.probeAudio(inputPath);
  const loud = await luster.analyzeLoudness(inputPath);
  const inputLufs = Number.isFinite(loud.integratedLufs) ? loud.integratedLufs : -14;

  const res = await luster.renderMaster({
    inputPath,
    wavPath,
    settings: chosen,
    metadata: { channels: meta.channels },
    inputLufs,
  });

  return {
    masteredFilename: `music-studio/mastered/${outName}`,
    targetLufs: res.settings.targetLufs,
    measuredLufs: inputLufs,
    normalization: res.normalization,
  };
}
