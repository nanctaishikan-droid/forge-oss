import { NextResponse } from "next/server";
import { masterTrack, MASTER_PRESETS } from "@/lib/master";
import { getJob, updateJob } from "@/lib/store";
import { mediaUrl, relFromUrl } from "@/lib/media";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/music-studio/master … 使えるマスタリングプリセット一覧
export async function GET() {
  return NextResponse.json({ presets: Object.keys(MASTER_PRESETS) });
}

// POST /api/music-studio/master
//   { jobId } または { filename } と、任意で { preset } / { settings }
// 生成済み音源をマスタリングして 48kHz/24bit WAV を書き出す。
export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      jobId?: string;
      filename?: string;
      preset?: string;
      settings?: Record<string, number>;
    };

    // 入力音源の相対パスを決める
    let inputRel = body.filename;
    let job = body.jobId ? getJob(body.jobId) : null;
    if (!inputRel && job?.audioUrl) {
      inputRel = relFromUrl(job.audioUrl);
    }
    if (!inputRel) {
      return NextResponse.json(
        { error: "jobId か filename が必要です" },
        { status: 400 }
      );
    }

    const result = await masterTrack(inputRel, body.settings, body.preset);
    const masteredUrl = mediaUrl(result.masteredFilename);

    if (job) {
      updateJob(job.id, {
        masteredUrl,
        masteredFilename: result.masteredFilename.split("/").pop(),
        masteredLufs: result.targetLufs,
        masterPreset: body.preset,
      });
    }

    return NextResponse.json({
      masteredUrl,
      targetLufs: result.targetLufs,
      measuredLufs: result.measuredLufs,
      normalization: result.normalization,
    });
  } catch (e) {
    return NextResponse.json(
      { error: `マスタリングに失敗しました: ${String(e)}` },
      { status: 500 }
    );
  }
}
