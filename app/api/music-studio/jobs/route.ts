import { NextResponse } from "next/server";
import { listJobs, updateJob, type Job } from "@/lib/store";
import { getHistory } from "@/lib/comfy";
import { mediaUrl } from "@/lib/media";

export const dynamic = "force-dynamic";

// 未完了ジョブをComfyUIの履歴で最新化する
async function refresh(jobs: Job[]): Promise<Job[]> {
  const pending = jobs.filter((j) => j.status === "QUEUED" || j.status === "RUNNING");
  await Promise.all(
    pending.map(async (j) => {
      const h = await getHistory(j.id);
      if (!h.found) {
        // まだ履歴に出ない＝キュー内/実行中
        if (j.status === "QUEUED") updateJob(j.id, { status: "RUNNING" });
        return;
      }
      if (h.status === "success" && h.audio && h.audio.length > 0) {
        const a = h.audio[0];
        const rel = a.subfolder ? `${a.subfolder}/${a.filename}` : a.filename;
        updateJob(j.id, {
          status: "COMPLETED",
          filename: a.filename,
          audioUrl: mediaUrl(rel),
        });
      } else if (h.error || h.status === "error") {
        updateJob(j.id, { status: "FAILED", error: h.error || "生成に失敗しました" });
      }
    })
  );
  return listJobs();
}

// GET /api/music-studio/jobs?limit=50  /  ?id=xxx（単体・最新化なし）
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (id) {
    const job = listJobs().find((j) => j.id === id) ?? null;
    if (!job) return NextResponse.json({ error: "見つかりません" }, { status: 404 });
    return NextResponse.json({ job });
  }
  const limit = Number(searchParams.get("limit") || "50");
  let jobs = listJobs();
  try {
    jobs = await refresh(jobs);
  } catch {
    // ComfyUI未起動でも台帳は返す
  }
  return NextResponse.json({ jobs: jobs.slice(0, limit) });
}
