import fs from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";
import { updateAlbum } from "@/lib/store";
import { mediaUrl } from "@/lib/media";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const COMFY_OUTPUT =
  process.env.COMFY_OUTPUT ||
  "C:\\Users\\YOUR_NAME\\ComfyUI_windows_portable\\ComfyUI\\output";

// POST /api/music-studio/albums/cover  (multipart: file, albumId)
// アルバムのカバー画像を保存して album.coverUrl を更新する。
export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const file = form.get("file");
    const albumId = String(form.get("albumId") || "");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "file がありません" }, { status: 400 });
    }
    if (!albumId) {
      return NextResponse.json({ error: "albumId が必要です" }, { status: 400 });
    }
    const ext = (path.extname(file.name) || ".jpg").toLowerCase();
    if (![".jpg", ".jpeg", ".png", ".webp"].includes(ext)) {
      return NextResponse.json({ error: "画像ファイルを選んでください" }, { status: 400 });
    }
    const dir = path.join(path.resolve(COMFY_OUTPUT), "music-studio", "covers");
    fs.mkdirSync(dir, { recursive: true });
    const name = `${albumId}${ext}`;
    fs.writeFileSync(path.join(dir, name), new Uint8Array(await file.arrayBuffer()));
    const rel = `music-studio/covers/${name}`;
    const coverUrl = `${mediaUrl(rel)}?t=${Date.now()}`;
    updateAlbum(albumId, { coverUrl, coverFilename: name });
    return NextResponse.json({ coverUrl });
  } catch (e) {
    return NextResponse.json(
      { error: `カバー保存に失敗しました: ${String(e)}` },
      { status: 500 }
    );
  }
}
