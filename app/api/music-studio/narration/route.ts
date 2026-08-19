import { NextResponse } from "next/server";
import { synthSpeech } from "@/lib/irodori";
import { addJob, type Job } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

// POST /api/music-studio/narration
//   { text, title?, refWavFile? }  refWavFile = /upload で保存した COMFY_INPUT 内のファイル名
// Irodori-TTS で日本語ナレーションを生成し、ライブラリに追加する。
export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      text?: string;
      title?: string;
      refWavFile?: string;
    };
    if (!body.text || !body.text.trim()) {
      return NextResponse.json({ error: "テキストを入力してください" }, { status: 400 });
    }

    const idHint = String(Date.now());
    const res = await synthSpeech(body.text.trim(), body.refWavFile, idHint);

    const now = Date.now();
    const job: Job = {
      id: `tts_${idHint}`,
      status: "COMPLETED",
      engine: "tts",
      presetId: "narration",
      title: body.title?.trim() || "🎙️ ナレーション",
      tags: "japanese narration (Irodori-TTS)",
      lyrics: body.text.trim(),
      seconds: Math.round(res.seconds),
      seed: 0,
      createdAt: now,
      updatedAt: now,
      audioUrl: res.url,
      filename: res.filename.split("/").pop(),
      reference: !!body.refWavFile,
    };
    addJob(job);
    return NextResponse.json({ job });
  } catch (e) {
    return NextResponse.json(
      { error: `ナレーション生成に失敗しました: ${String(e)}` },
      { status: 500 }
    );
  }
}
