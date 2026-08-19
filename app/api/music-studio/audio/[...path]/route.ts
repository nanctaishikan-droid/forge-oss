import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// 旧URL互換用のリダイレクタ。
// 実配信は Next の静的配信 /media (public/media = ComfyUI output のジャンクション) が担当。
// ここではバイナリを返さず /media へ 307 リダイレクトするだけ（devワーカーを不安定にしない）。
export async function GET(
  req: Request,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path: parts } = await params;
  const rel = parts.map((p) => p.split("?")[0]).join("/");
  return NextResponse.redirect(new URL(`/media/${rel}`, req.url), 307);
}
