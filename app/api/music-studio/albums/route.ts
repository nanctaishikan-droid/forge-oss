import { NextResponse } from "next/server";
import {
  listAlbums,
  getAlbum,
  createAlbum,
  updateAlbum,
  deleteAlbum,
  type Album,
} from "@/lib/store";

export const dynamic = "force-dynamic";

// GET /api/music-studio/albums          … 一覧
// GET /api/music-studio/albums?id=xxx   … 単体
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (id) {
    const a = getAlbum(id);
    if (!a) return NextResponse.json({ error: "見つかりません" }, { status: 404 });
    return NextResponse.json({ album: a });
  }
  return NextResponse.json({ albums: listAlbums() });
}

// POST … 新規作成 { title }
export async function POST(req: Request) {
  const body = (await req.json()) as { title?: string };
  const album = createAlbum(body.title || "無題のアルバム");
  return NextResponse.json({ album });
}

// PATCH … 更新 { id, ...patch }
export async function PATCH(req: Request) {
  const body = (await req.json()) as { id: string } & Partial<Album>;
  if (!body.id) return NextResponse.json({ error: "id が必要です" }, { status: 400 });
  const { id, ...patch } = body;
  const album = updateAlbum(id, patch);
  if (!album) return NextResponse.json({ error: "見つかりません" }, { status: 404 });
  return NextResponse.json({ album });
}

// DELETE … 削除 { id }
export async function DELETE(req: Request) {
  const body = (await req.json()) as { id?: string };
  if (!body.id) return NextResponse.json({ error: "id が必要です" }, { status: 400 });
  deleteAlbum(body.id);
  return NextResponse.json({ ok: true });
}
