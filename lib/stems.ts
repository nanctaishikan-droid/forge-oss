// ステム分離(Demucs)＆リミックス(FFmpeg)。生成済み音源を「歌/ドラム/ベース/ギター/ピアノ/その他」
// に分解し、各パートの音量を個別に調整して書き出す（画面編集ツールのバックエンド）。
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { mediaUrl } from "./media";

const COMFY_OUTPUT =
  process.env.COMFY_OUTPUT ||
  "C:\\Users\\YOUR_NAME\\ComfyUI_windows_portable\\ComfyUI\\output";

// 分離用の独立venv（ComfyUI本体を汚さない）
const SEP_PYTHON =
  process.env.SEP_PYTHON ||
  path.resolve(process.cwd(), "tools", "sep-venv", "Scripts", "python.exe");
const SEP_SCRIPT = path.resolve(process.cwd(), "scripts", "separate.py");

const STEM_ORDER = ["vocals", "drums", "bass", "guitar", "piano", "other"];

function run(cmd: string, args: string[]): Promise<{ code: number; stderr: string; stdout: string }> {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (d) => (stdout += d.toString()));
    child.stderr.on("data", (d) => (stderr += d.toString()));
    child.on("error", (e) => resolve({ code: -1, stderr: String(e), stdout }));
    child.on("close", (code) => resolve({ code: code ?? -1, stderr, stdout }));
  });
}

function panFilter(p?: number): string | null {
  if (p === undefined || p === null || Math.abs(p) < 0.02) return null;
  const pp = Math.max(-1, Math.min(1, p));
  const lg = pp <= 0 ? 1 : (1 - pp).toFixed(3);
  const rg = pp >= 0 ? 1 : (1 + pp).toFixed(3);
  return `pan=stereo|c0=${lg}*c0|c1=${rg}*c1`;
}
function outUrl(relUnderOutput: string): string {
  return mediaUrl(relUnderOutput);
}

export interface SeparateResult {
  stemsId: string;
  stems: Record<string, string>; // stem名 -> 配信URL
}

export async function separateTrack(inputRel: string): Promise<SeparateResult> {
  const base = path.resolve(COMFY_OUTPUT);
  const inputPath = path.resolve(base, inputRel);
  if (!inputPath.startsWith(base)) throw new Error("不正な入力パス");
  if (!fs.existsSync(inputPath)) throw new Error("元の音源が見つかりません");
  if (!fs.existsSync(SEP_PYTHON))
    throw new Error("分離用の環境(sep-venv)が見つかりません。tools/sep-venv を作成してください。");

  const stemsId = path.basename(inputPath, path.extname(inputPath));
  const outDir = path.join(base, "music-studio", "stems", stemsId);
  fs.mkdirSync(outDir, { recursive: true });

  const r = await run(SEP_PYTHON, [
    SEP_SCRIPT,
    "--in",
    inputPath,
    "--out",
    outDir,
    "--model",
    "htdemucs_6s",
  ]);
  if (r.code !== 0) {
    throw new Error(`ステム分離に失敗: ${r.stderr.slice(-800) || r.stdout.slice(-800)}`);
  }

  const stems: Record<string, string> = {};
  for (const name of STEM_ORDER) {
    const wav = path.join(outDir, `${name}.wav`);
    if (fs.existsSync(wav)) {
      stems[name] = outUrl(`music-studio/stems/${stemsId}/${name}.wav`);
    }
  }
  if (Object.keys(stems).length === 0) throw new Error("分離結果が空でした");
  return { stemsId, stems };
}

export interface RemixOptions {
  gains?: Record<string, number>; // stem名 -> dB (0=そのまま)
  mutes?: Record<string, boolean>; // stem名 -> ミュート
  vocalCleanup?: boolean; // 歌声のノイズ/反響を軽減
  fadeOut?: number; // 末尾フェードアウト秒
  fadeIn?: number; // 冒頭フェードイン秒
  trimStart?: number; // 開始トリム秒
  trimEnd?: number; // 終了位置秒（0/未指定で最後まで）
}

async function probeDuration(file: string): Promise<number> {
  const r = await run("ffprobe", [
    "-v",
    "error",
    "-show_entries",
    "format=duration",
    "-of",
    "default=nokey=1:noprint_wrappers=1",
    file,
  ]);
  const d = parseFloat(r.stdout.trim());
  return Number.isFinite(d) ? d : 0;
}

export interface RemixResult {
  remixFilename: string; // music-studio/remix/<id>_remix.mp3
  remixUrl: string;
}

export async function remixStems(
  stemsId: string,
  opts: RemixOptions
): Promise<RemixResult> {
  const base = path.resolve(COMFY_OUTPUT);
  const stemsDir = path.join(base, "music-studio", "stems", stemsId);
  if (!fs.existsSync(stemsDir)) throw new Error("先にステム分離を行ってください");

  const active = STEM_ORDER.filter(
    (n) => fs.existsSync(path.join(stemsDir, `${n}.wav`)) && !(opts.mutes?.[n])
  );
  if (active.length === 0) throw new Error("少なくとも1つのパートを有効にしてください");

  const args: string[] = ["-hide_banner", "-nostats", "-y"];
  for (const n of active) args.push("-i", path.join(stemsDir, `${n}.wav`));

  // 各入力に音量（＋歌声クリーンアップ）を適用
  const labels: string[] = [];
  const parts: string[] = [];
  active.forEach((n, i) => {
    const gain = opts.gains?.[n] ?? 0;
    const chain: string[] = [];
    if (n === "vocals" && opts.vocalCleanup) {
      // 反響/ノイズを軽減: ノイズ抑制→低域カット→軽いゲートで残響尾を抑える
      chain.push("afftdn=nf=-25", "highpass=f=90", "agate=threshold=0.03:ratio=2:attack=5:release=120");
    }
    chain.push(`volume=${gain}dB`);
    parts.push(`[${i}:a]${chain.join(",")}[a${i}]`);
    labels.push(`[a${i}]`);
  });

  // ミックス（normalize=0 で各自の音量を尊重）
  parts.push(`${labels.join("")}amix=inputs=${active.length}:normalize=0[mix]`);
  let last = "mix";

  // トリム
  const trimStart = opts.trimStart && opts.trimStart > 0 ? opts.trimStart : 0;
  const trimEnd = opts.trimEnd && opts.trimEnd > 0 ? opts.trimEnd : 0;
  if (trimStart || trimEnd) {
    const seg =
      `atrim=start=${trimStart}` + (trimEnd ? `:end=${trimEnd}` : "") + `,asetpts=PTS-STARTPTS`;
    parts.push(`[${last}]${seg}[trim]`);
    last = "trim";
  }

  // フェード（末尾は総尺から逆算）
  const dur =
    (trimEnd || (await probeDuration(path.join(stemsDir, `${active[0]}.wav`)))) -
    trimStart;
  const fades: string[] = [];
  if (opts.fadeIn && opts.fadeIn > 0) fades.push(`afade=t=in:st=0:d=${opts.fadeIn}`);
  if (opts.fadeOut && opts.fadeOut > 0 && dur > 0) {
    const st = Math.max(0, dur - opts.fadeOut);
    fades.push(`afade=t=out:st=${st.toFixed(2)}:d=${opts.fadeOut}`);
  }
  if (fades.length) {
    parts.push(`[${last}]${fades.join(",")}[out]`);
    last = "out";
  }

  const remixDir = path.join(base, "music-studio", "remix");
  fs.mkdirSync(remixDir, { recursive: true });
  const outName = `${stemsId}_remix.mp3`;
  const outPath = path.join(remixDir, outName);

  args.push(
    "-filter_complex",
    parts.join(";"),
    "-map",
    `[${last}]`,
    "-c:a",
    "libmp3lame",
    "-q:a",
    "2",
    outPath
  );

  const r = await run("ffmpeg", args);
  if (r.code !== 0) throw new Error(`リミックスに失敗: ${r.stderr.slice(-800)}`);

  const rel = `music-studio/remix/${outName}`;
  return { remixFilename: outName, remixUrl: outUrl(rel) };
}

// ===== マルチトラック・ミックスダウン（各パートに音量＋EQ、全体にトリム/フェード） =====
export interface EqBand {
  freq: number;
  gain: number; // dB
  q: number;
}
export interface Region {
  start: number; // 秒
  end: number; // 秒
  gain: number; // dB（-60でほぼミュート）
  fade?: "in" | "out";
}
export interface TrackSetting {
  stem: string;
  gain?: number; // dB
  mute?: boolean;
  eq?: EqBand[];
  regions?: Region[]; // 区間ごとの音量（範囲を絞る/ミュート）
  comp?: boolean; // コンプレッサー（音を揃える）
  reverb?: number; // リバーブ量 0-100（空間・広がり）
  auto?: { t: number; v: number }[]; // 音量オートメーション（t秒, vゲイン倍率）
  pan?: number; // -1(左)〜+1(右)
}
export interface MixdownGlobal {
  trimStart?: number;
  trimEnd?: number;
  fadeIn?: number;
  fadeOut?: number;
}

// 音量オートメーションの点→FFmpeg volume式
function autoExpr(points: { t: number; v: number }[]): string | null {
  const p = [...points].sort((a, b) => a.t - b.t);
  if (p.length < 2) return null;
  const f = (n: number) => n.toFixed(3);
  let expr = `if(lt(t,${f(p[0].t)}),${f(p[0].v)},`;
  for (let i = 0; i < p.length - 1; i++) {
    const a = p[i];
    const b = p[i + 1];
    const span = b.t - a.t || 0.001;
    expr += `if(lt(t,${f(b.t)}),${f(a.v)}+(${f(b.v)}-${f(a.v)})*(t-${f(a.t)})/${f(span)},`;
  }
  expr += f(p[p.length - 1].v) + ')'.repeat(p.length); // segments + leading clamp
  const esc = expr.replace(/,/g, '\\,');
  return `volume=eval=frame:volume='${esc}'`;
}

export async function mixdownStems(
  stemsId: string,
  tracks: TrackSetting[],
  global: MixdownGlobal
): Promise<RemixResult> {
  const base = path.resolve(COMFY_OUTPUT);
  const stemsDir = path.join(base, "music-studio", "stems", stemsId);
  if (!fs.existsSync(stemsDir)) throw new Error("先にステム分離を行ってください");

  const active = tracks.filter(
    (t) => fs.existsSync(path.join(stemsDir, `${t.stem}.wav`)) && !t.mute
  );
  if (active.length === 0) throw new Error("少なくとも1つのパートを有効にしてください");

  const args: string[] = ["-hide_banner", "-nostats", "-y"];
  for (const t of active) args.push("-i", path.join(stemsDir, `${t.stem}.wav`));

  const parts: string[] = [];
  const labels: string[] = [];
  active.forEach((t, i) => {
    const chain: string[] = [`volume=${t.gain ?? 0}dB`];
    for (const b of t.eq || []) {
      if (!b || !b.freq || b.gain === 0) continue;
      const f = Math.max(20, Math.min(20000, Math.round(b.freq)));
      const q = Math.max(0.1, Math.min(20, b.q || 1));
      const g = Math.max(-40, Math.min(20, b.gain));
      chain.push(`equalizer=f=${f}:width_type=q:w=${q}:g=${g}`);
    }
    // コンプレッサー（粒を揃えて前に出す）
    if (t.comp) {
      chain.push("acompressor=threshold=-18dB:ratio=3:attack=20:release=200:makeup=2");
    }
    // リバーブ（空間・広がり）※aechoで近似
    if (t.reverb && t.reverb > 0) {
      const amt = Math.max(0, Math.min(100, t.reverb)) / 100;
      const d1 = (amt * 0.4).toFixed(2);
      const d2 = (amt * 0.25).toFixed(2);
      chain.push(`aecho=0.8:0.9:50|90:${d1}|${d2}`);
    }
    // 音量オートメーション
    if (t.auto && t.auto.length >= 2) {
      const ae = autoExpr(t.auto);
      if (ae) chain.push(ae);
    }
    // 区間ごとの音量（範囲を絞る/ミュート/フェード）
    for (const r of t.regions || []) {
      if (!r || r.end <= r.start) continue;
      const a = r.start.toFixed(3);
      const b = r.end.toFixed(3);
      const span = (r.end - r.start).toFixed(3);
      if (r.fade === "out") {
        chain.push(`volume=eval=frame:volume='if(between(t\\,${a}\\,${b})\\,(${b}-t)/${span}\\,1)'`);
      } else if (r.fade === "in") {
        chain.push(`volume=eval=frame:volume='if(between(t\\,${a}\\,${b})\\,(t-${a})/${span}\\,1)'`);
      } else {
        const g = Math.max(-60, Math.min(12, r.gain));
        chain.push(`volume=enable='between(t\\,${a}\\,${b})':volume=${g}dB`);
      }
    }
    const pf = panFilter(t.pan);
    if (pf) chain.push(pf);
    parts.push(`[${i}:a]${chain.join(",")}[a${i}]`);
    labels.push(`[a${i}]`);
  });
  parts.push(`${labels.join("")}amix=inputs=${active.length}:normalize=0[mix]`);
  let last = "mix";

  const trimStart = global.trimStart && global.trimStart > 0 ? global.trimStart : 0;
  const trimEnd = global.trimEnd && global.trimEnd > 0 ? global.trimEnd : 0;
  if (trimStart || trimEnd) {
    parts.push(
      `[${last}]atrim=start=${trimStart}` +
        (trimEnd ? `:end=${trimEnd}` : "") +
        `,asetpts=PTS-STARTPTS[trim]`
    );
    last = "trim";
  }

  const dur =
    (trimEnd || (await probeDuration(path.join(stemsDir, `${active[0].stem}.wav`)))) -
    trimStart;
  const fades: string[] = [];
  if (global.fadeIn && global.fadeIn > 0) fades.push(`afade=t=in:st=0:d=${global.fadeIn}`);
  if (global.fadeOut && global.fadeOut > 0 && dur > 0) {
    const st = Math.max(0, dur - global.fadeOut);
    fades.push(`afade=t=out:st=${st.toFixed(2)}:d=${global.fadeOut}`);
  }
  if (fades.length) {
    parts.push(`[${last}]${fades.join(",")}[out]`);
    last = "out";
  }

  const remixDir = path.join(base, "music-studio", "remix");
  fs.mkdirSync(remixDir, { recursive: true });
  const outName = `${stemsId}_mix.wav`;
  const outPath = path.join(remixDir, outName);

  args.push(
    "-filter_complex",
    parts.join(";"),
    "-map",
    `[${last}]`,
    "-ar",
    "48000",
    "-c:a",
    "pcm_s24le",
    outPath
  );

  const r = await run("ffmpeg", args);
  if (r.code !== 0) throw new Error(`ミックスダウンに失敗: ${r.stderr.slice(-800)}`);

  const rel = `music-studio/remix/${outName}`;
  return { remixFilename: outName, remixUrl: outUrl(rel) };
}

// ===== クリップ編集のミックスダウン（各パートを分割/移動したブロックで再構成） =====
export interface Clip {
  srcStart: number; // 元音源の開始位置(秒)
  srcDur: number;   // クリップの長さ(秒)
  offset: number;   // タイムライン上の配置位置(秒)
  gain?: number;    // dB
  fadeIn?: number;  // クリップ先頭フェードイン(秒)
  fadeOut?: number; // クリップ末尾フェードアウト(秒)
  mute?: boolean;
}
export interface ClipTrack {
  stem: string;
  gain?: number; // dB
  eq?: EqBand[];
  comp?: boolean;
  reverb?: number;
  pan?: number;
  clips: Clip[];
}

export async function clipMixdownStems(
  stemsId: string,
  tracks: ClipTrack[],
  global: MixdownGlobal
): Promise<RemixResult> {
  const base = path.resolve(COMFY_OUTPUT);
  const stemsDir = path.join(base, "music-studio", "stems", stemsId);
  if (!fs.existsSync(stemsDir)) throw new Error("先にステム分離を行ってください");

  const active = tracks.filter(
    (t) => fs.existsSync(path.join(stemsDir, `${t.stem}.wav`)) && (t.clips || []).length > 0
  );
  if (active.length === 0) throw new Error("配置されたクリップがありません");

  const args: string[] = ["-hide_banner", "-nostats", "-y"];
  active.forEach((t) => args.push("-i", path.join(stemsDir, `${t.stem}.wav`)));

  const parts: string[] = [];
  const trackLabels: string[] = [];
  active.forEach((t, ti) => {
    const clips = (t.clips || []).filter((c) => !c.mute && c.srcDur > 0);
    if (clips.length === 0) return;
    // 入力を clip 数だけ複製
    const splitOuts = clips.map((_, ci) => `[t${ti}s${ci}]`);
    parts.push(`[${ti}:a]asplit=${clips.length}${splitOuts.join("")}`);
    const clipLabels: string[] = [];
    clips.forEach((c, ci) => {
      const s = Math.max(0, c.srcStart);
      const e = (s + c.srcDur).toFixed(3);
      const offMs = Math.max(0, Math.round(c.offset * 1000));
      const g = Math.max(-40, Math.min(12, c.gain ?? 0));
      const fi = Math.max(0, c.fadeIn ?? 0);
      const fo = Math.max(0, c.fadeOut ?? 0);
      const fadeParts: string[] = [];
      if (fi > 0) fadeParts.push(`afade=t=in:st=0:d=${Math.min(fi, c.srcDur).toFixed(3)}`);
      if (fo > 0 && fo < c.srcDur) fadeParts.push(`afade=t=out:st=${(c.srcDur - fo).toFixed(3)}:d=${fo.toFixed(3)}`);
      const fadeStr = fadeParts.length ? fadeParts.join(",") + "," : "";
      parts.push(
        `[t${ti}s${ci}]atrim=start=${s.toFixed(3)}:end=${e},asetpts=PTS-STARTPTS,` +
          `${fadeStr}adelay=delays=${offMs}:all=1,volume=${g}dB[t${ti}c${ci}]`
      );
      clipLabels.push(`[t${ti}c${ci}]`);
    });
    // トラック内のクリップを合成
    let last = `[t${ti}pre]`;
    if (clipLabels.length === 1) {
      parts.push(`${clipLabels[0]}anull${last}`);
    } else {
      parts.push(`${clipLabels.join("")}amix=inputs=${clipLabels.length}:normalize=0${last}`);
    }
    // トラックのエフェクト（EQ/コンプ/リバーブ/音量）
    const chain: string[] = [];
    for (const b of t.eq || []) {
      if (!b || !b.freq || b.gain === 0) continue;
      const f = Math.max(20, Math.min(20000, Math.round(b.freq)));
      const q = Math.max(0.1, Math.min(20, b.q || 1));
      const bg = Math.max(-40, Math.min(20, b.gain));
      chain.push(`equalizer=f=${f}:width_type=q:w=${q}:g=${bg}`);
    }
    if (t.comp) chain.push("acompressor=threshold=-18dB:ratio=3:attack=20:release=200:makeup=2");
    if (t.reverb && t.reverb > 0) {
      const amt = Math.max(0, Math.min(100, t.reverb)) / 100;
      chain.push(`aecho=0.8:0.9:50|90:${(amt * 0.4).toFixed(2)}|${(amt * 0.25).toFixed(2)}`);
    }
    chain.push(`volume=${t.gain ?? 0}dB`);
    const pf2 = panFilter(t.pan);
    if (pf2) chain.push(pf2);
    parts.push(`${last}${chain.join(",")}[track${ti}]`);
    trackLabels.push(`[track${ti}]`);
  });

  if (trackLabels.length === 0) throw new Error("有効なクリップがありません");
  parts.push(`${trackLabels.join("")}amix=inputs=${trackLabels.length}:normalize=0[mix]`);
  let last = "mix";

  const trimStart = global.trimStart && global.trimStart > 0 ? global.trimStart : 0;
  const trimEnd = global.trimEnd && global.trimEnd > 0 ? global.trimEnd : 0;
  if (trimStart || trimEnd) {
    parts.push(
      `[${last}]atrim=start=${trimStart}` + (trimEnd ? `:end=${trimEnd}` : "") + `,asetpts=PTS-STARTPTS[trim]`
    );
    last = "trim";
  }
  const fades: string[] = [];
  if (global.fadeIn && global.fadeIn > 0) fades.push(`afade=t=in:st=0:d=${global.fadeIn}`);
  if (global.fadeOut && global.fadeOut > 0) {
    // 末尾位置が不明なので trimEnd 優先、無ければ概算スキップ
    if (trimEnd) fades.push(`afade=t=out:st=${Math.max(0, trimEnd - trimStart - global.fadeOut).toFixed(2)}:d=${global.fadeOut}`);
  }
  if (fades.length) {
    parts.push(`[${last}]${fades.join(",")}[out]`);
    last = "out";
  }

  const remixDir = path.join(base, "music-studio", "remix");
  fs.mkdirSync(remixDir, { recursive: true });
  const outName = `${stemsId}_clip.wav`;
  const outPath = path.join(remixDir, outName);
  args.push("-filter_complex", parts.join(";"), "-map", `[${last}]`, "-ar", "48000", "-c:a", "pcm_s24le", outPath);

  const r = await run("ffmpeg", args);
  if (r.code !== 0) throw new Error(`クリップ書き出しに失敗: ${r.stderr.slice(-900)}`);
  const rel = `music-studio/remix/${outName}`;
  return { remixFilename: outName, remixUrl: outUrl(rel) };
}
