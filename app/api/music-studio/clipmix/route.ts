import { NextResponse } from "next/server";
import { clipMixdownStems, type ClipTrack, type MixdownGlobal } from "@/lib/stems";
import { getJob, updateJob } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

// POST /api/music-studio/clipmix { jobId?, stemsId, tracks: ClipTrack[], global }
export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      jobId?: string;
      stemsId?: string;
      tracks?: ClipTrack[];
      global?: MixdownGlobal;
    };
    const job = body.jobId ? getJob(body.jobId) : null;
    const stemsId = body.stemsId || job?.stemsId;
    if (!stemsId) return NextResponse.json({ error: "stemsId が必要です" }, { status: 400 });
    const res = await clipMixdownStems(stemsId, body.tracks || [], body.global || {});
    if (job) updateJob(job.id, { remixUrl: res.remixUrl, remixFilename: res.remixFilename });
    return NextResponse.json(res);
  } catch (e) {
    return NextResponse.json({ error: `クリップ書き出しに失敗しました: ${String(e)}` }, { status: 500 });
  }
}
