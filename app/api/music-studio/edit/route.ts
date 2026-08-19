import { NextResponse } from "next/server";
import { editTrack, type EditOptions } from "@/lib/edit";
import { getJob, updateJob } from "@/lib/store";
import { relFromUrl } from "@/lib/media";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

// POST /api/music-studio/edit
//   { jobId?, filename?, source?, ...EditOptions }
// source: "original" | "mastered" | "remix"（既定 original）— どの音源を編集するか
export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      jobId?: string;
      filename?: string;
      source?: "original" | "mastered" | "remix";
    } & EditOptions;

    const job = body.jobId ? getJob(body.jobId) : null;
    let inputRel = body.filename;
    if (!inputRel && job) {
      const url =
        body.source === "mastered"
          ? job.masteredUrl
          : body.source === "remix"
          ? job.remixUrl
          : job.audioUrl;
      if (url) inputRel = relFromUrl(url);
    }
    if (!inputRel) {
      return NextResponse.json({ error: "jobId か filename が必要です" }, { status: 400 });
    }

    const result = await editTrack(inputRel, {
      eq: body.eq,
      fadeIn: body.fadeIn,
      fadeOut: body.fadeOut,
      trimStart: body.trimStart,
      trimEnd: body.trimEnd,
      highpass: body.highpass,
      lowpass: body.lowpass,
    });

    if (job) {
      updateJob(job.id, {
        editedUrl: result.editedUrl,
        editedFilename: result.editedFilename,
      });
    }
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json(
      { error: `編集に失敗しました: ${String(e)}` },
      { status: 500 }
    );
  }
}
