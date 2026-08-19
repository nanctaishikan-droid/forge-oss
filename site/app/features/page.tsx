import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "機能",
  description:
    "生成・マスタリング・ステム分解・マルチトラック編集・ナレーション・アルバム管理・LoRA。FORGE でできることの一覧。",
};

const GROUPS = [
  {
    k: "Generate",
    title: "曲を生成する",
    lead: "かんたんモードは選ぶだけ。フルカスタムモードでは、曲の設計をひと通り自分で決められます。",
    items: [
      "歌詞は [verse] / [chorus] / [bridge] の構造タグに対応。インストへの切り替えも可能",
      "ボーカル指定：性別・年齢・声質（あたたかい／透明感／ハスキー等の複数選択）・言語",
      "楽器ミキサー：ギター・ドラム・ベース・ピアノ・シンセなどを「控えめ〜主役級」で調整",
      "音楽設定：BPM・キー・長さ・ステップ数・CFG",
      "参照音声をアップロードして、声質や音色を寄せる（ReferenceTimbreAudio）",
      "作曲モード：イントロ / Aメロ / Bメロ / サビ を構成として並べて作る",
    ],
    engines: ["ACE-Step 1.5（歌モノ既定）", "ACE-Step v1（声寄せ・LoRA）", "Stable Audio Open（SE・ループ）"],
  },
  {
    k: "Master",
    title: "マスタリングで仕上げる",
    lead: "「どれを選べばいいか分からない」を避けるため、各プリセットの効果をメーターと言葉で示します。",
    items: [
      "そのまま：加工感ゼロ。音量だけ配信標準へ寄せる（原音の雰囲気重視）",
      "大きく・迫力：いちばん大きく、キックやアタックを前に。SNS・配信向け",
      "クリア・繊細：高域の抜けと空気感、広がり重視。歌モノ・アコースティック向け",
      "カスタム：温かさ／明瞭さ／空気感／迫力／広がり／目標音圧を手動調整",
      "同じ曲で「別の仕上げを試す」→ A/B で聴き比べ",
      "書き出しは 48kHz / 24bit WAV",
    ],
    engines: ["Luster（EBU R128 ラウドネス正規化 + True Peak 制御）"],
  },
  {
    k: "Separate",
    title: "パートに分解する",
    lead: "「歌と伴奏が混ざりすぎている」「ギターだけ抑えたい」を、パート単位で解決します。",
    items: [
      "6パート分離：歌 / ドラム / ベース / ギター / ピアノ / その他",
      "パートごとに音量・ミュート・ソロを個別操作",
      "歌声のクリーンアップ（反響・ノイズの低減）",
      "調整した状態でリミックスして書き出し",
    ],
    engines: ["Demucs htdemucs_6s（高品質設定：shifts 2 / overlap 0.5）"],
  },
  {
    k: "Edit",
    title: "重ねて編集する",
    lead: "分解したパートを並べて、実際に手で触って直せる編集画面です。スクロールを使わない全画面レイアウト。",
    items: [
      "クリップ：分割・移動・複製・長さ変更・ミュート・削除",
      "クリップごとのゲインとフェードイン／アウト（波形上に視覚表示）",
      "トラックごとのパン（左右定位）とリアルタイム・レベルメーター",
      "EQ（低域・中域・高域）／コンプレッサー／リバーブ",
      "音量オートメーション（点を打ってカーブを描く）",
      "範囲を選んで増減・フェード、トリム、元に戻す／やり直す",
      "編集結果は FFmpeg で 48kHz / 24bit WAV に書き出し",
    ],
    engines: ["内蔵マルチトラック・エディタ（Web Audio + FFmpeg）"],
  },
  {
    k: "Voice",
    title: "ナレーションを作る",
    lead: "曲だけでなく、日本語の話し声も同じライブラリの中で扱えます。",
    items: [
      "日本語の自然な話し声を生成",
      "絵文字で感情のニュアンスを制御",
      "参照音声から自分の声にクローン",
      "生成した音声はライブラリに追加され、編集画面で曲に重ねられる",
    ],
    engines: ["Irodori-TTS（OpenAI互換サーバー :8088）"],
  },
  {
    k: "Library",
    title: "まとめて管理する",
    lead: "作った曲が散らからないように、アルバム単位で束ねて書き出せます。",
    items: [
      "カバー画像・曲名・曲順の管理",
      "連番ファイル名 + カバー + 曲目リストでフォルダ書き出し",
      "マスタリング済みがあれば自動で採用",
      "毎日決まった時刻に自動生成してライブラリに追加（任意の常駐プロセス）",
    ],
    engines: ["アルバム管理 / スケジューラ"],
  },
  {
    k: "LoRA",
    title: "音色モデルを育てる",
    lead: "既製のモデルだけでなく、自分で学習させた音色を足せるのがローカルの強みです。",
    items: [
      "ComfyUI の loras フォルダに置いた自前 LoRA をフルカスタムから選択",
      "学習用のデータ準備スクリプトと手順を同梱（training/）",
      "ボイスクローンは自分の声かライセンス済み音源のみに使う",
    ],
    engines: ["LoraLoaderModelOnly / 学習手順は training/README.md"],
  },
];

export default function FeaturesPage() {
  return (
    <>
      <div className="wrap page-head">
        <p className="eyebrow">機能</p>
        <h1>FORGE でできること</h1>
        <p>
          生成して終わりではなく、分解して、直して、仕上げて、束ねるところまで。
          すべてローカルで動くオープンソースのエンジンを組み合わせています。
        </p>
      </div>

      <section className="section" style={{ borderTop: "none", paddingTop: 0 }}>
        <div className="wrap stack" style={{ gap: 16 }}>
          {GROUPS.map((g) => (
            <article className="card" key={g.k} style={{ padding: 28 }}>
              <span className="k">{g.k}</span>
              <h3 style={{ fontSize: 21 }}>{g.title}</h3>
              <p>{g.lead}</p>
              <ul>
                {g.items.map((it) => (
                  <li key={it}>{it}</li>
                ))}
              </ul>
              <div className="tagrow">
                {g.engines.map((e) => (
                  <span key={e}>{e}</span>
                ))}
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="section">
        <div className="wrap">
          <div className="sec-head">
            <p className="eyebrow">次に</p>
            <h2>試してみる</h2>
            <p>導入は zip を Claude Code に渡すだけです。必要なPCの条件も先に確認できます。</p>
          </div>
          <div className="hero-actions" style={{ marginTop: 0 }}>
            <Link className="btn btn-primary" href="/setup">
              導入ガイドへ
            </Link>
            <Link className="btn btn-ghost" href="/specs">
              必要スペックを見る
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
