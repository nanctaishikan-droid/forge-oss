import { NextResponse } from "next/server";
import { mixdownStems, type TrackSetting, type MixdownGlobal } from "@/lib/stems";
import { getJob, updateJob } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

// POST /api/music-studio/mixdown
//   { jobId?, stemsId, tracks: TrackSetting[], global: MixdownGlobal }
// 分離済みステムを各パートの音量+EQ、全体のトリム/フェードで合成し、48kHz/24bit WAVで出力。
export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      jobId?: string;
      stemsId?: string;
      tracks?: TrackSetting[];
      global?: MixdownGlobal;
    };
    const job = body.jobId ? getJob(body.jobId) : null;
    const stemsId = body.stemsId || job?.stemsId;
    if (!stemsId) {
      return NextResponse.json({ error: "stemsId が必要です（先に分解）" }, { status: 400 });
    }
    const res = await mixdownStems(stemsId, body.tracks || [], body.global || {});
    if (job) updateJob(job.id, { remixUrl: res.remixUrl, remixFilename: res.remixFilename });
    return NextResponse.json(res);
  } catch (e) {
    return NextResponse.json(
      { error: `ミックスダウンに失敗しました: ${String(e)}` },
      { status: 500 }
    );
  }
}
