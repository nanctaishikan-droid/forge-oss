import { NextResponse } from "next/server";
import { startRemake, type RemakeInput } from "@/lib/remake";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/music-studio/remake { jobId, denoise?, tags?, lyrics? }
export async function POST(req: Request) {
  try {
    const body = (await req.json()) as RemakeInput;
    if (!body.jobId) {
      return NextResponse.json({ error: "jobId が必要です" }, { status: 400 });
    }
    const job = await startRemake(body);
    return NextResponse.json({ job });
  } catch (e) {
    return NextResponse.json(
      { error: `作り直しに失敗しました: ${String(e)}` },
      { status: 500 }
    );
  }
}
