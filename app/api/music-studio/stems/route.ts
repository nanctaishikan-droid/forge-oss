import { NextResponse } from "next/server";
import { separateTrack } from "@/lib/stems";
import { getJob, updateJob } from "@/lib/store";
import { relFromUrl } from "@/lib/media";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

// POST /api/music-studio/stems  { jobId } または { filename }
// 曲を6ステム(歌/ドラム/ベース/ギター/ピアノ/その他)に分解する。
export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { jobId?: string; filename?: string };
    let inputRel = body.filename;
    const job = body.jobId ? getJob(body.jobId) : null;
    if (!inputRel && job?.audioUrl) {
      inputRel = relFromUrl(job.audioUrl);
    }
    if (!inputRel) {
      return NextResponse.json({ error: "jobId か filename が必要です" }, { status: 400 });
    }

    const res = await separateTrack(inputRel);
    if (job) updateJob(job.id, { stemsId: res.stemsId, stems: res.stems });
    return NextResponse.json(res);
  } catch (e) {
    return NextResponse.json(
      { error: `ステム分離に失敗しました: ${String(e)}` },
      { status: 500 }
    );
  }
}
