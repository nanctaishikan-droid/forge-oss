// サイト共通フッター。配布・ドキュメント・ライセンスへの導線をまとめる。
import Link from "next/link";
import { REPO_URL, ZIP_URL } from "@/lib/song";

export function Footer() {
  return (
    <footer className="footer">
      <div className="wrap">
        <div className="footer-inner">
          <div className="footer-col">
            <h4>FORGE</h4>
            <span style={{ maxWidth: "34ch" }}>
              ローカルGPUで動く音楽制作スタジオ。生成・編集・仕上げまで、すべて手元で。
            </span>
          </div>

          <div className="footer-col">
            <h4>ドキュメント</h4>
            <Link href="/features">機能一覧</Link>
            <Link href="/setup">導入ガイド</Link>
            <Link href="/specs">必要スペック</Link>
          </div>

          <div className="footer-col">
            <h4>入手</h4>
            <a href={REPO_URL} target="_blank" rel="noopener noreferrer">
              GitHub リポジトリ
            </a>
            <a href={ZIP_URL}>zip をダウンロード</a>
            <a href={`${REPO_URL}/blob/main/LICENSE`} target="_blank" rel="noopener noreferrer">
              ライセンス（MIT）
            </a>
          </div>

          <div className="footer-col">
            <h4>構成要素</h4>
            <span>ACE-Step / Stable Audio Open</span>
            <span>Demucs / Irodori-TTS</span>
            <span>Next.js + ComfyUI</span>
          </div>
        </div>

        <div className="footer-bottom">
          FORGE · MIT License · モデルとサードパーティは各配布元のライセンスに従います
        </div>
      </div>
    </footer>
  );
}
