import { NextResponse } from "next/server";
import { startGeneration, type GenerateInput } from "@/lib/generate";

export const dynamic = "force-dynamic";

// POST /api/music-studio/generate  … 1曲の生成を開始
export async function POST(req: Request) {
  try {
    const body = (await req.json()) as GenerateInput;
    if (!body) {
      return NextResponse.json({ error: "リクエストが空です" }, { status: 400 });
    }
    // simpleモードはベースのプリセットが必要。customは任意（各種指定から合成）。
    if (body.mode !== "custom" && !body.presetId) {
      return NextResponse.json({ error: "presetId は必須です" }, { status: 400 });
    }
    const job = await startGeneration(body);
    return NextResponse.json({ job });
  } catch (e) {
    return NextResponse.json(
      { error: `生成の開始に失敗しました: ${String(e)}` },
      { status: 500 }
    );
  }
}
