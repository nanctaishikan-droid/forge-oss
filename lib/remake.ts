// 既存曲を種に「作り直す（変奏/リメイク）」。音声2音声(ACE-Step v1)。
import fs from "node:fs";
import path from "node:path";
import { submitPrompt } from "./comfy";
import { buildRemakeWorkflow } from "./workflows";
import { relFromUrl } from "./media";
import { addJob, getJob, type Job } from "./store";

const COMFY_OUTPUT =
  process.env.COMFY_OUTPUT ||
  "C:\Users\YOUR_NAME\ComfyUI_windows_portable\ComfyUI\output";
const COMFY_INPUT =
  process.env.COMFY_INPUT ||
  "C:\Users\YOUR_NAME\ComfyUI_windows_portable\ComfyUI\input";

export interface RemakeInput {
  jobId: string;
  denoise?: number; // 変化の強さ 0.2〜0.9
  tags?: string; // 差し替えスタイル（空で原曲のtags）
  lyrics?: string; // 差し替え歌詞（未指定で原曲の歌詞）
}

export async function startRemake(input: RemakeInput): Promise<Job> {
  const job = getJob(input.jobId);
  if (!job) throw new Error("元の曲が見つかりません");
  const srcUrl = job.audioUrl;
  if (!srcUrl) throw new Error("元の音源がありません");

  const rel = relFromUrl(srcUrl);
  const abs = path.resolve(COMFY_OUTPUT, rel);
  if (!fs.existsSync(abs)) throw new Error("元の音源ファイルが見つかりません");

  if (!fs.existsSync(COMFY_INPUT)) fs.mkdirSync(COMFY_INPUT, { recursive: true });
  const ext = path.extname(abs) || ".mp3";
  const inName = `remake_src_${Date.now()}${ext}`;
  fs.copyFileSync(abs, path.join(COMFY_INPUT, inName));

  const tags = input.tags?.trim() || job.tags;
  const lyrics = input.lyrics !== undefined ? input.lyrics : job.lyrics;
  const seed = Math.floor(Math.random() * 2 ** 31);

  const wf = buildRemakeWorkflow({
    inputFile: inName,
    tags,
    lyrics,
    denoise: input.denoise ?? 0.6,
    seed,
    filenamePrefix: "music-studio/remake",
  });
  const promptId = await submitPrompt(wf);

  const now = Date.now();
  const newJob: Job = {
    id: promptId,
    status: "QUEUED",
    engine: "ace",
    presetId: job.presetId,
    title: `${job.title}（作り直し）`,
    tags,
    lyrics,
    seconds: job.seconds,
    seed,
    createdAt: now,
    updatedAt: now,
    hasVocals: !!lyrics,
  };
  addJob(newJob);
  return newJob;
}
