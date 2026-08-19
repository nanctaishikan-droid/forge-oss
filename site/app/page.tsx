import Link from "next/link";
import { Player } from "@/components/Player";
import { REPO_URL, ZIP_URL } from "@/lib/song";

// 信号の流れ（生成 → 編集 → 仕上げ → 分解）は実際の制作順序そのものなので、
// 番号ではなく「チェーン」として並べる。
const CHAIN = [
  {
    k: "01 · Generate",
    title: "曲を生成する",
    body: "歌詞・スタイル・ボーカル・楽器バランス・BPM・キーを指定して、手元のGPUで生成。回数に上限はありません。",
    engine: "ACE-Step 1.5 / v1 / Stable Audio Open",
  },
  {
    k: "02 · Separate",
    title: "パートに分ける",
    body: "1曲を歌・ドラム・ベース・ギター・ピアノ・その他の6パートへ分離。混ざりすぎた音をパート単位で扱えます。",
    engine: "Demucs htdemucs_6s",
  },
  {
    k: "03 · Edit",
    title: "重ねて編集する",
    body: "クリップの分割・移動・複製、フェード、パン、EQ・コンプ・リバーブ、音量オートメーションをリアルタイム試聴しながら。",
    engine: "内蔵マルチトラック・エディタ",
  },
  {
    k: "04 · Master",
    title: "仕上げて書き出す",
    body: "ラウドネス正規化と True Peak 制御で配信基準へ。3つのプリセットの違いはメーターで見て選べます。",
    engine: "Luster · 48kHz/24bit WAV",
  },
];

const COMPARE = [
  ["生成の上限", "月間の生成回数に上限", "上限なし（自分のGPU次第）"],
  ["データの置き場所", "クラウドにアップロード", "すべて手元のディスク"],
  ["モデル", "全員共通", "差し替え・自前LoRAの追加が可能"],
  ["編集", "限定的", "分解 → マルチトラック編集 → マスタリング"],
  ["費用", "月額課金", "無料（電気代とGPUのみ）"],
];

const FEATURES = [
  {
    k: "Generate",
    title: "フルカスタム生成",
    body: "かんたん / フルカスタムの2モード。構造タグ付きの歌詞、声質の細かい指定、参照音声による声寄せまで。",
    tags: ["歌詞構造タグ", "ボーカル指定", "楽器ミキサー"],
  },
  {
    k: "Master",
    title: "違いが分かるマスタリング",
    body: "そのまま / 大きく・迫力 / クリア・繊細＋カスタム。効果をメーターと言葉で示し、A/B で聴き比べられます。",
    tags: ["EBU R128", "True Peak", "A/B比較"],
  },
  {
    k: "Edit",
    title: "マルチトラック編集",
    body: "波形とクリップを直接操作。ゲイン・フェード・パン・レベルメーター・オートメーションを全画面レイアウトで。",
    tags: ["クリップ編集", "ミキサー", "オートメーション"],
  },
  {
    k: "Voice",
    title: "日本語ナレーション",
    body: "話し声を生成し、絵文字で感情を制御。参照音声から自分の声にクローンして曲に重ねられます。",
    tags: ["Irodori-TTS", "ボイスクローン"],
  },
];

export default function Home() {
  return (
    <>
      {/* ヒーロー：最も特徴的な「実際に生成した曲」を主役に置く */}
      <header className="hero">
        <div className="wrap">
          <p className="eyebrow">自分のGPUで、無制限に</p>
          <h1 className="hero-word">FORGE</h1>
          <p className="hero-lead">クラウドに預けない、音楽制作スタジオ。</p>
          <p className="hero-sub">
            手元の ComfyUI で生成し、内蔵エディタで編集し、Luster で仕上げる。
            月間上限もアップロードもなく、生成から書き出しまでのすべてがあなたのPCの中で完結します。
          </p>

          <div className="chips">
            <span className="chip">
              <b>生成</b> ACE-Step 1.5
            </span>
            <span className="chip">
              <b>編集</b> 波形エディタ
            </span>
            <span className="chip">
              <b>仕上げ</b> Luster マスタリング
            </span>
            <span className="chip">
              <b>分解</b> Demucs 6ステム
            </span>
            <span className="chip">
              <b>音声</b> Irodori-TTS
            </span>
          </div>

          <div className="hero-actions">
            <a className="btn btn-primary" href={ZIP_URL}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              zip をダウンロード
            </a>
            <Link className="btn btn-ghost" href="/setup">
              導入ガイドを見る
            </Link>
          </div>

          <Player />
          <p className="note-line">
            ※ このデモ曲は FORGE 上で実際に生成した1曲です。歌詞・メロディはすべてオリジナル（既存曲の流用はありません）。
          </p>
        </div>
      </header>

      {/* 制作の流れ */}
      <section className="section">
        <div className="wrap">
          <div className="sec-head">
            <p className="eyebrow">制作の流れ</p>
            <h2>作る → 分ける → 直す → 仕上げる</h2>
            <p>
              4つの工程が1つのアプリでつながっています。それぞれローカルのオープンソースのエンジンが動いていて、
              途中で外部にデータを送ることはありません。
            </p>
          </div>

          <div className="chain">
            {CHAIN.map((c) => (
              <div className="chain-node" key={c.k}>
                <span className="k">{c.k}</span>
                <h3>{c.title}</h3>
                <p>{c.body}</p>
                <span className="engine">{c.engine}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ローカルである理由 */}
      <section className="section">
        <div className="wrap">
          <div className="sec-head">
            <p className="eyebrow">なぜローカルか</p>
            <h2>上限も、アップロードもない</h2>
            <p>
              クラウドの音楽生成サービスと比べたときに、実際に変わるところだけを挙げます。
            </p>
          </div>

          <div className="table-scroll">
            <table className="data">
              <thead>
                <tr>
                  <th>観点</th>
                  <th>クラウドのサービス</th>
                  <th>FORGE（ローカル）</th>
                </tr>
              </thead>
              <tbody>
                {COMPARE.map((row) => (
                  <tr key={row[0]}>
                    <td className="key">{row[0]}</td>
                    <td className="val">{row[1]}</td>
                    <td>{row[2]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="callout">
            必要なのは <b>VRAM 8GB</b> 程度の NVIDIA GPU だけ。派手なPCは要りません
            （参考: RTX 4070 で 150 秒の曲が約 2 分で生成できます）。
            <Link href="/specs"> 必要スペックとPCチェック →</Link>
          </div>
        </div>
      </section>

      {/* 機能ダイジェスト */}
      <section className="section">
        <div className="wrap">
          <div className="sec-head">
            <p className="eyebrow">主な機能</p>
            <h2>生成だけで終わらせない</h2>
            <p>
              生成した曲をそのまま置いておくのではなく、分解して、直して、仕上げるところまで面倒を見ます。
            </p>
          </div>

          <div className="grid-cards">
            {FEATURES.map((f) => (
              <div className="card" key={f.k}>
                <span className="k">{f.k}</span>
                <h3>{f.title}</h3>
                <p>{f.body}</p>
                <div className="tagrow">
                  {f.tags.map((t) => (
                    <span key={t}>{t}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div style={{ marginTop: 24 }}>
            <Link className="btn btn-ghost" href="/features">
              機能の詳細を見る
            </Link>
          </div>
        </div>
      </section>

      {/* ダウンロード帯 */}
      <section className="dlband">
        <div className="wrap dl-inner">
          <div className="dl-copy">
            <p className="eyebrow">ダウンロード</p>
            <h2>zip を Claude Code に渡すだけ</h2>
            <p>
              ソース一式と導入手順書（<code>SETUP.md</code>）が入っています。解凍したフォルダを
              Claude Code で開いて「SETUP.md に沿って導入して」と伝えれば、前提チェックから起動まで
              確認しながら自動で進みます。手作業はモデルの配置だけです。
            </p>
          </div>
          <div className="dl-actions">
            <a className="btn btn-primary" href={ZIP_URL}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              zip をダウンロード
            </a>
            <span className="dl-note">
              公開リポジトリ:{" "}
              <a href={REPO_URL} target="_blank" rel="noopener noreferrer">
                github.com/nanctaishikan-droid/forge-oss
              </a>
              <br />
              前提 → Node.js 20+ · FFmpeg · Git · ComfyUI(8188)
            </span>
          </div>
        </div>
      </section>
    </>
  );
}
