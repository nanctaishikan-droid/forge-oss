import { NextResponse } from "next/server";
import { remixStems, type RemixOptions } from "@/lib/stems";
import { getJob, updateJob } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

// POST /api/music-studio/remix
//   { jobId?, stemsId, gains, mutes, vocalCleanup, fadeOut, fadeIn, trimStart, trimEnd }
// 分離済みステムを各パート音量つきで再ミックスして書き出す（編集ツール）。
export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { jobId?: string; stemsId?: string } & RemixOptions;
    const job = body.jobId ? getJob(body.jobId) : null;
    const stemsId = body.stemsId || job?.stemsId;
    if (!stemsId) {
      return NextResponse.json({ error: "stemsId が必要です（先に分離）" }, { status: 400 });
    }

    const res = await remixStems(stemsId, {
      gains: body.gains,
      mutes: body.mutes,
      vocalCleanup: body.vocalCleanup,
      fadeOut: body.fadeOut,
      fadeIn: body.fadeIn,
      trimStart: body.trimStart,
      trimEnd: body.trimEnd,
    });

    if (job) updateJob(job.id, { remixUrl: res.remixUrl, remixFilename: res.remixFilename });
    return NextResponse.json(res);
  } catch (e) {
    return NextResponse.json(
      { error: `リミックスに失敗しました: ${String(e)}` },
      { status: 500 }
    );
  }
}
