// Irodori-TTS サーバー（OpenAI互換 :8088）のクライアント。
// 日本語ナレーション音声の生成＋参照音声からの声クローンに対応。
import fs from "node:fs";
import path from "node:path";
import { mediaUrl } from "./media";

export const IRODORI_HOST = process.env.IRODORI_HOST || "http://127.0.0.1:8088";
const COMFY_OUTPUT =
  process.env.COMFY_OUTPUT ||
  "C:\\Users\\YOUR_NAME\\ComfyUI_windows_portable\\ComfyUI\\output";
const COMFY_INPUT =
  process.env.COMFY_INPUT ||
  "C:\\Users\\YOUR_NAME\\ComfyUI_windows_portable\\ComfyUI\\input";

export async function irodoriHealth(): Promise<boolean> {
  try {
    const r = await fetch(`${IRODORI_HOST}/health`, { cache: "no-store" });
    return r.ok;
  } catch {
    return false;
  }
}

export interface SynthResult {
  filename: string; // music-studio/tts/tts_xxx.wav
  url: string;
  seconds: number;
}

// text: 日本語（絵文字で感情制御可）。refWavFile: COMFY_INPUT内のファイル名（声クローン用）
export async function synthSpeech(
  text: string,
  refWavFile?: string,
  idHint?: string
): Promise<SynthResult> {
  const body: Record<string, unknown> = {
    model: "irodori-tts",
    input: text,
    voice: "none",
    response_format: "wav",
  };
  if (refWavFile) {
    const abs = path.resolve(COMFY_INPUT, refWavFile);
    if (!fs.existsSync(abs)) throw new Error("参照音声が見つかりません");
    body.irodori = { ref_wav: abs };
  }

  const res = await fetch(`${IRODORI_HOST}/v1/audio/speech`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Irodori TTS 失敗 (${res.status}): ${t.slice(0, 400)}`);
  }
  const buf = new Uint8Array(await res.arrayBuffer());

  const ttsDir = path.join(path.resolve(COMFY_OUTPUT), "music-studio", "tts");
  fs.mkdirSync(ttsDir, { recursive: true });
  const name = `tts_${idHint || Date.now()}.wav`;
  fs.writeFileSync(path.join(ttsDir, name), buf);

  // 尺をざっくり見積もり（WAVヘッダから）。失敗しても致命的でない。
  let seconds = 0;
  try {
    seconds = wavDuration(buf);
  } catch {
    /* noop */
  }

  const rel = `music-studio/tts/${name}`;
  return {
    filename: rel,
    url: mediaUrl(rel),
    seconds,
  };
}

// 簡易WAV長さ計算（PCM前提）
function wavDuration(buf: Uint8Array): number {
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  // "data" チャンクを探す
  let offset = 12;
  let byteRate = 0;
  let dataSize = 0;
  while (offset + 8 <= buf.length) {
    const id = String.fromCharCode(
      buf[offset],
      buf[offset + 1],
      buf[offset + 2],
      buf[offset + 3]
    );
    const size = dv.getUint32(offset + 4, true);
    if (id === "fmt ") byteRate = dv.getUint32(offset + 8 + 8, true);
    if (id === "data") {
      dataSize = size;
      break;
    }
    offset += 8 + size + (size % 2);
  }
  return byteRate > 0 ? dataSize / byteRate : 0;
}
