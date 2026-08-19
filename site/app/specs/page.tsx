import type { Metadata } from "next";
import Link from "next/link";
import { PcCheck } from "@/components/PcCheck";

export const metadata: Metadata = {
  title: "必要スペック",
  description:
    "FORGE を動かすための最低ライン。VRAM 8GB 程度の NVIDIA GPU があれば動きます。ブラウザからPC構成を確認できるセルフチェック付き。",
};

const SPECS: [string, string][] = [
  ["GPU", "NVIDIA GeForce（VRAM 8GB〜）例: GTX 1070 / RTX 3050 / RTX 3060"],
  ["VRAM", "8GB（6GB でも省メモリ設定で可。GPUなし＝CPUのみでも動くが低速）"],
  ["メモリ", "16GB"],
  ["ストレージ", "SSD 20GB 空き（モデル込み）"],
  ["CPU", "4コア"],
  ["OS", "Windows 10 / 11（mac・Linux も ComfyUI が動けば可）"],
  ["依存ソフト", "Node.js 20+ ／ FFmpeg ／ Git ／ ComfyUI（分解・音声を使うなら Python 3.10+）"],
];

export default function SpecsPage() {
  return (
    <>
      <div className="wrap page-head">
        <p className="eyebrow">必要スペック</p>
        <h1>動かすための最低ライン</h1>
        <p>
          派手なPCは要りません。効いてくるのは NVIDIA GPU の VRAM だけで、
          あとは「速いか、ゆっくりか」の差にしかなりません。
        </p>
      </div>

      <section className="section" style={{ borderTop: "none", paddingTop: 8 }}>
        <div className="wrap">
          <div className="table-scroll">
            <table className="data">
              <thead>
                <tr>
                  <th>項目</th>
                  <th>最低ライン</th>
                </tr>
              </thead>
              <tbody>
                {SPECS.map(([k, v]) => (
                  <tr key={k}>
                    <td className="key">{k}</td>
                    <td className="val">{v}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="callout">
            「動くこと」を優先した数字です。<b>VRAM 8GB</b> のGPUは数年前〜ミドルクラスで手が届きます。
            非力なGPUでも、時間をかければ生成そのものは可能です
            （参考: RTX 4070 で 150 秒の曲が約 2 分。控えめなGPUではその数倍かかります）。
          </div>
        </div>
      </section>

      <section className="section">
        <div className="wrap">
          <PcCheck />
        </div>
      </section>

      <section className="section">
        <div className="wrap">
          <div className="sec-head">
            <p className="eyebrow">補足</p>
            <h2>スペックの読み方</h2>
            <p>どこが効いて、どこは気にしなくていいのかをまとめます。</p>
          </div>

          <div className="grid-cards">
            <div className="card">
              <span className="k">GPU / VRAM</span>
              <h3>ここだけが本当に効く</h3>
              <p>
                生成の速さはほぼ GPU で決まります。VRAM が足りないと生成が止まるので、
                8GB を目安にしてください。多いほど速くなりますが、仕上がりの音質が変わるわけではありません。
              </p>
            </div>
            <div className="card">
              <span className="k">CPU / メモリ</span>
              <h3>普通のPCで足ります</h3>
              <p>
                編集や書き出し（FFmpeg）とステム分解で使いますが、突出した性能は不要です。
                4コア・16GB あれば通して動きます。
              </p>
            </div>
            <div className="card">
              <span className="k">ストレージ</span>
              <h3>モデルの分だけ見ておく</h3>
              <p>
                生成モデルが数GBあります。曲は1本あたり数MBなので、20GB ほど空いていれば
                しばらく困りません。SSD だと待ち時間が短くなります。
              </p>
            </div>
            <div className="card">
              <span className="k">ネットワーク</span>
              <h3>導入時だけ必要</h3>
              <p>
                モデルと依存パッケージのダウンロードにだけ使います。動かし始めてからは、
                生成も編集もオフラインで完結します。
              </p>
            </div>
          </div>

          <div style={{ marginTop: 28 }} className="hero-actions">
            <Link className="btn btn-primary" href="/setup">
              導入ガイドへ
            </Link>
            <Link className="btn btn-ghost" href="/features">
              機能を見る
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
