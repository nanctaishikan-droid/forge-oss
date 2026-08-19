// 波形/スペクトログラム編集の書き出し（FFmpeg）。
// パラメトリックEQ（特定周波数の増減/ノッチ）・フェード・トリムを適用し、48kHz/24bit WAVで出力。
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { mediaUrl } from "./media";

const COMFY_OUTPUT =
  process.env.COMFY_OUTPUT ||
  "C:\\Users\\YOUR_NAME\\ComfyUI_windows_portable\\ComfyUI\\output";

export interface EqBand {
  freq: number; // Hz
  gain: number; // dB（負でカット/ノッチ）
  q: number; // 帯域の鋭さ
}

export interface EditOptions {
  eq?: EqBand[];
  fadeIn?: number; // 秒
  fadeOut?: number; // 秒
  trimStart?: number; // 秒
  trimEnd?: number; // 秒（0/未指定で末尾まで）
  highpass?: number; // 指定Hz以下をカット（0で無効）
  lowpass?: number; // 指定Hz以上をカット（0で無効）
}

function run(cmd: string, args: string[]): Promise<{ code: number; stderr: string; stdout: string }> {
  return new Promise((resolve) => {
    const c = spawn(cmd, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stderr = "";
    let stdout = "";
    c.stdout.on("data", (d) => (stdout += d.toString()));
    c.stderr.on("data", (d) => (stderr += d.toString()));
    c.on("error", (e) => resolve({ code: -1, stderr: String(e), stdout }));
    c.on("close", (code) => resolve({ code: code ?? -1, stderr, stdout }));
  });
}

async function probeDuration(file: string): Promise<number> {
  const r = await run("ffprobe", [
    "-v", "error", "-show_entries", "format=duration",
    "-of", "default=nokey=1:noprint_wrappers=1", file,
  ]);
  const d = parseFloat(r.stdout.trim());
  return Number.isFinite(d) ? d : 0;
}

export interface EditResult {
  editedFilename: string; // music-studio/edited/<id>_edit.wav
  editedUrl: string;
}

export async function editTrack(inputRel: string, opts: EditOptions): Promise<EditResult> {
  const base = path.resolve(COMFY_OUTPUT);
  const inputPath = path.resolve(base, inputRel);
  if (!inputPath.startsWith(base)) throw new Error("不正な入力パス");
  if (!fs.existsSync(inputPath)) throw new Error("元の音源が見つかりません");

  const filters: string[] = [];
  const trimStart = opts.trimStart && opts.trimStart > 0 ? opts.trimStart : 0;
  const trimEnd = opts.trimEnd && opts.trimEnd > 0 ? opts.trimEnd : 0;
  if (trimStart || trimEnd) {
    filters.push(
      `atrim=start=${trimStart}` + (trimEnd ? `:end=${trimEnd}` : "") + `,asetpts=PTS-STARTPTS`
    );
  }
  if (opts.highpass && opts.highpass > 0) filters.push(`highpass=f=${Math.round(opts.highpass)}`);
  if (opts.lowpass && opts.lowpass > 0) filters.push(`lowpass=f=${Math.round(opts.lowpass)}`);

  for (const b of opts.eq || []) {
    if (!b || !b.freq || b.gain === 0) continue;
    const f = Math.max(20, Math.min(20000, Math.round(b.freq)));
    const q = Math.max(0.1, Math.min(20, b.q || 1));
    const g = Math.max(-40, Math.min(20, b.gain));
    filters.push(`equalizer=f=${f}:width_type=q:w=${q}:g=${g}`);
  }

  // フェード（トリム後の尺で計算）
  const srcDur = await probeDuration(inputPath);
  const dur = (trimEnd || srcDur) - trimStart;
  if (opts.fadeIn && opts.fadeIn > 0) filters.push(`afade=t=in:st=0:d=${opts.fadeIn}`);
  if (opts.fadeOut && opts.fadeOut > 0 && dur > 0) {
    const st = Math.max(0, dur - opts.fadeOut);
    filters.push(`afade=t=out:st=${st.toFixed(2)}:d=${opts.fadeOut}`);
  }

  const editedDir = path.join(base, "music-studio", "edited");
  fs.mkdirSync(editedDir, { recursive: true });
  const stem = path.basename(inputPath, path.extname(inputPath));
  const outName = `${stem}_edit.wav`;
  const outPath = path.join(editedDir, outName);

  const args = ["-hide_banner", "-nostats", "-y", "-i", inputPath];
  if (filters.length) args.push("-af", filters.join(","));
  args.push("-ar", "48000", "-c:a", "pcm_s24le", outPath);

  const r = await run("ffmpeg", args);
  if (r.code !== 0) throw new Error(`編集の書き出しに失敗: ${r.stderr.slice(-800)}`);

  const rel = `music-studio/edited/${outName}`;
  return { editedFilename: outName, editedUrl: mediaUrl(rel) };
}
