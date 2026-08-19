import fs from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const COMFY_INPUT =
  process.env.COMFY_INPUT ||
  "C:\\Users\\YOUR_NAME\\ComfyUI_windows_portable\\ComfyUI\\input";

// POST /api/music-studio/upload  (multipart, field: "file")
// 参照音声を ComfyUI の input フォルダへ保存し、LoadAudio 用のファイル名を返す。
export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "file がありません" }, { status: 400 });
    }
    const ext = (path.extname(file.name) || ".mp3").toLowerCase();
    if (![".mp3", ".wav", ".flac", ".m4a", ".ogg", ".opus"].includes(ext)) {
      return NextResponse.json({ error: "対応していない音声形式です" }, { status: 400 });
    }
    if (!fs.existsSync(COMFY_INPUT)) fs.mkdirSync(COMFY_INPUT, { recursive: true });

    const safeBase = `ms_ref_${Date.now()}${ext}`;
    const dest = path.join(COMFY_INPUT, safeBase);
    const buf = new Uint8Array(await file.arrayBuffer());
    fs.writeFileSync(dest, buf);

    return NextResponse.json({ filename: safeBase });
  } catch (e) {
    return NextResponse.json(
      { error: `アップロードに失敗しました: ${String(e)}` },
      { status: 500 }
    );
  }
}
