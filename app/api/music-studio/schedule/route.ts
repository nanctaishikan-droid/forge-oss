import { NextResponse } from "next/server";
import { getSchedule, setSchedule, type Schedule } from "@/lib/store";

export const dynamic = "force-dynamic";

// GET /api/music-studio/schedule … 現在の自動生成設定
export async function GET() {
  return NextResponse.json({ schedule: getSchedule() });
}

// PUT /api/music-studio/schedule … 自動生成設定を更新
export async function PUT(req: Request) {
  try {
    const patch = (await req.json()) as Partial<Schedule>;
    const schedule = setSchedule(patch);
    return NextResponse.json({ schedule });
  } catch (e) {
    return NextResponse.json(
      { error: `設定の更新に失敗しました: ${String(e)}` },
      { status: 500 }
    );
  }
}
