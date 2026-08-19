import fs from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";
import { getAlbum, getJob } from "@/lib/store";
import { relFromUrl } from "@/lib/media";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const COMFY_OUTPUT =
  process.env.COMFY_OUTPUT ||
  "C:\\Users\\YOUR_NAME\\ComfyUI_windows_portable\\ComfyUI\\output";
const DATA_DIR = process.env.DATA_DIR
  ? path.resolve(process.env.DATA_DIR)
  : path.resolve(process.cwd(), "data");

function safeName(s: string): string {
  return s.replace(/[\\/:*?"<>|]/g, "_").trim() || "untitled";
}

// 配信URL → 実ファイルの絶対パス
function urlToPath(url?: string): string | null {
  if (!url) return null;
  const abs = path.resolve(COMFY_OUTPUT, relFromUrl(url));
  return fs.existsSync(abs) ? abs : null;
}

// POST /api/music-studio/albums/export { id }
// アルバムを DATA_DIR/exports/<タイトル>/ にフォルダ書き出しする。
export async function POST(req: Request) {
  try {
    const { id } = (await req.json()) as { id?: string };
    if (!id) return NextResponse.json({ error: "id が必要です" }, { status: 400 });
    const album = getAlbum(id);
    if (!album) return NextResponse.json({ error: "アルバムが見つかりません" }, { status: 404 });

    const dir = path.join(DATA_DIR, "exports", safeName(album.title));
    fs.mkdirSync(dir, { recursive: true });

    const lines: string[] = [`# ${album.title}`, ""];
    let n = 0;
    let copied = 0;
    for (const jobId of album.trackIds) {
      n += 1;
      const job = getJob(jobId);
      if (!job) continue;
      // 最終版を優先: マスタリング > リミックス > 原音
      const src =
        urlToPath(job.masteredUrl) ||
        urlToPath(job.remixUrl) ||
        urlToPath(job.audioUrl);
      if (!src) {
        lines.push(`${String(n).padStart(2, "0")}. ${job.title}（ファイル無し）`);
        continue;
      }
      const ext = path.extname(src);
      const dst = path.join(dir, `${String(n).padStart(2, "0")} - ${safeName(job.title)}${ext}`);
      fs.copyFileSync(src, dst);
      copied += 1;
      lines.push(`${String(n).padStart(2, "0")}. ${job.title}`);
    }

    // カバー
    const coverSrc = urlToPath(album.coverUrl);
    if (coverSrc) {
      fs.copyFileSync(coverSrc, path.join(dir, `cover${path.extname(coverSrc)}`));
    }
    // 曲目リスト
    fs.writeFileSync(path.join(dir, "tracklist.txt"), lines.join("\n"), "utf-8");

    return NextResponse.json({ folder: dir, tracks: copied });
  } catch (e) {
    return NextResponse.json(
      { error: `書き出しに失敗しました: ${String(e)}` },
      { status: 500 }
    );
  }
}
