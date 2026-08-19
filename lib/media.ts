// 音声/画像は Next の静的配信(public/media = ComfyUI output のジャンクション)で配る。
// ルートハンドラ経由の大きなバイナリ配信は dev のワーカーを不安定にするため避ける。

// output配下の相対パス → 配信URL
export function mediaUrl(rel: string): string {
  return `/media/${rel.split("/").map(encodeURIComponent).join("/")}`;
}

// 配信URL(新旧どちらの形式でも) → output配下の相対パス
export function relFromUrl(url: string): string {
  return decodeURIComponent(
    url
      .replace(/^\/media\//, "")
      .replace(/^\/api\/music-studio\/audio\//, "")
      .split("?")[0]
  );
}
