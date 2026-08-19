"use client";

import Link from "next/link";
import { useState } from "react";
import { Chevron, Logo } from "@/components/icons";

const GLOSSARY: { term: string; desc: string }[] = [
  { term: "トリム (Trim)", desc: "曲の不要な前後を切り取ること。「開始トリム3秒」なら頭の3秒を削り、「終了トリム」で末尾を短くします。長さ自体を詰める操作です。" },
  { term: "フェードイン / フェードアウト", desc: "音量をだんだん上げる(イン)／下げる(アウト)こと。「フェードアウト3秒」なら終わりの3秒で音がスーッと消えます。ブツッと切れないための処理。" },
  { term: "EQ（イコライザー）", desc: "音の高さ(周波数)ごとに音量を上げ下げする調整。低音を足すと厚く、高音を足すと抜けが良く、こもりは中音を下げると改善します。" },
  { term: "ソロ (S) / ミュート (M)", desc: "ソロ=そのパートだけを鳴らす。ミュート=そのパートを消す。ドラムだけ聴きたい→ドラムをソロ、ボーカルを消したい→ボーカルをミュート。" },
  { term: "ステム / トラック", desc: "曲を「ボーカル/ドラム/ベース/ギター/ピアノ/その他」に分解した個々のパート音源。1パート=1トラックとして個別に編集できます。" },
  { term: "マスタリング", desc: "曲の最終仕上げ。全体の音量(音圧)を配信の標準に整え、EQやコンプで聴きやすくして書き出す工程。プリセットで一発調整できます。" },
  { term: "LUFS（音圧の単位）", desc: "曲全体の体感的な大きさの単位。0に近いほど大きい。配信は -9〜-14 LUFS が目安。数値が大きい=ガツンと大きく聞こえます。" },
  { term: "スペクトログラム", desc: "「どの高さの音が・いつ・どれだけ鳴っているか」を色で示す図（縦=音の高さ、横=時間）。ノイズ探しなどに使うプロ向けの表示です。" },
  { term: "区間選択（範囲編集）", desc: "波形の上をドラッグして「ここからここまで」を選び、その範囲だけ音量を絞る/ミュートする編集。サビだけ上げる等の細かい調整に使います。" },
  { term: "リペイント / 延長（生成側）", desc: "リペイント=曲の一部分だけを作り直す。延長=曲の前後を伸ばす。イントロやサビなど構成ごとの作り込みに使えます。" },
  { term: "LoRA（音色モデル）", desc: "自分の曲や声で追加学習した「自分専用のクセ/音色」。適用すると自分だけのサウンドで生成できます。" },
];

const FAQ: { q: string; a: string }[] = [
  { q: "曲はどうやって作りますか？", a: "左の「かんたん」で雰囲気を選んで「曲を作る」。もっと細かくしたいなら「フルカスタム」で歌詞・楽器・ボーカル・BPM・キーを指定します。1〜3分で右のライブラリに出ます。" },
  { q: "歌が濁る・こもるときは？", a: "エディタ(曲の「編集」)で楽器ごとに分解 → ボーカルのEQで中音を少し下げる、伴奏を少し絞る、で改善します。歌自体の明瞭さは ACE-Step 1.5(既定) が安定します。" },
  { q: "ボーカルだけ聴きたい／消したい", a: "編集画面で各トラックの「S(ソロ)」「M(ミュート)」を使います。ボーカルをソロにすると歌だけ、ミュートするとカラオケになります。" },
  { q: "特定の部分だけ音量を下げたい", a: "編集画面で波形をドラッグして範囲を選び、「選択範囲を絞る/ミュート」を押します。その区間だけ音量が変わります。" },
  { q: "書き出した曲はどこ？", a: "各曲の「DL」ボタン、または編集/マスタリングの「WAVをダウンロード」から保存できます。アルバムにまとめてフォルダ書き出しも可能です。" },
  { q: "商用利用できますか？", a: "生成モデル(ACE-Step)は Apache-2.0 で商用OK。Stable Audio Open は年商$1M未満なら商用可。配信前は重複チェックをおすすめします。" },
  { q: "自分の声で歌わせたい", a: "「ナレーション」タブで参照音声をアップすると、その声に寄せた読み上げができます。歌声の完全再現は声のLoRA学習が必要です(training/ 参照)。" },
];

function Item({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-[var(--border)]">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 py-3 text-left text-sm font-medium hover:text-[var(--accent-2)]"
      >
        <Chevron size={16} className={`transition-transform ${open ? "rotate-0" : "-rotate-90"}`} />
        {q}
      </button>
      {open && <p className="pb-3 pl-6 text-sm text-[var(--text-dim)] leading-relaxed">{a}</p>}
    </div>
  );
}

export default function HelpPage() {
  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)]">
      <header className="sticky top-0 z-10 border-b border-[var(--border)] bg-[var(--bg)]/95 backdrop-blur px-5 py-3 flex items-center gap-3">
        <Link
          href="/music-studio"
          className="flex items-center gap-1 text-sm text-[var(--text-dim)] hover:text-[var(--text)]"
        >
          <Chevron className="rotate-90" size={16} /> スタジオ
        </Link>
        <div className="w-px h-5 bg-[var(--border)]" />
        <Logo size={20} />
        <h1 className="text-sm font-semibold">ヘルプ・用語ガイド</h1>
      </header>

      <div className="max-w-3xl mx-auto px-5 py-8">
        <h2 className="text-lg font-bold mb-1">よくある質問</h2>
        <p className="text-sm text-[var(--text-dim)] mb-4">
          迷ったらここ。項目をクリックで開きます。
        </p>
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 mb-10">
          {FAQ.map((f) => (
            <Item key={f.q} {...f} />
          ))}
        </div>

        <h2 className="text-lg font-bold mb-1">用語集</h2>
        <p className="text-sm text-[var(--text-dim)] mb-4">
          画面に出てくる言葉の意味です。
        </p>
        <div className="grid gap-3">
          {GLOSSARY.map((g) => (
            <div
              key={g.term}
              className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3"
            >
              <div className="text-sm font-semibold text-[var(--accent-2)] mb-0.5">{g.term}</div>
              <div className="text-sm text-[var(--text-dim)] leading-relaxed">{g.desc}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
