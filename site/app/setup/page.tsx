import type { Metadata } from "next";
import Link from "next/link";
import { CodeBlock } from "@/components/CodeBlock";
import { REPO_URL, ZIP_URL } from "@/lib/song";

export const metadata: Metadata = {
  title: "導入ガイド",
  description:
    "zip を Claude Code に渡すだけで導入できます。前提ソフト、モデル配置、起動、トラブルシュートまでの手順。",
};

export default function SetupPage() {
  return (
    <>
      <div className="wrap page-head">
        <p className="eyebrow">導入ガイド</p>
        <h1>zip を Claude Code に渡すだけ</h1>
        <p>
          配布物には、AIコーディングエージェント <b>Claude Code</b> 用のセットアップ手順書
          （<code>SETUP.md</code>）が入っています。フォルダを開いて一言伝えれば、前提チェックから
          起動確認まで、判断が必要なところだけ質問しながら自動で進みます。
        </p>
      </div>

      {/* 前提 */}
      <section className="section" style={{ borderTop: "none", paddingTop: 8 }}>
        <div className="wrap">
          <div className="sec-head">
            <p className="eyebrow">はじめに</p>
            <h2>用意しておくもの</h2>
            <p>
              FORGE は生成そのものを ComfyUI に任せます。ComfyUI が動く状態であることが唯一の重い前提です。
            </p>
          </div>

          <div className="table-scroll">
            <table className="data">
              <thead>
                <tr>
                  <th>必要なもの</th>
                  <th>用途</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="key">ComfyUI</td>
                  <td className="val">音楽生成の本体。ポート <span className="u">8188</span> で起動できること</td>
                </tr>
                <tr>
                  <td className="key">Node.js 20+</td>
                  <td className="val">アプリ本体（Next.js）の実行</td>
                </tr>
                <tr>
                  <td className="key">FFmpeg</td>
                  <td className="val">マスタリング・編集・書き出し（必須）</td>
                </tr>
                <tr>
                  <td className="key">Git</td>
                  <td className="val">取得と更新</td>
                </tr>
                <tr>
                  <td className="key">Python 3.10+</td>
                  <td className="val">ステム分解・ナレーションを使う場合のみ</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div style={{ marginTop: 18 }}>
            <CodeBlock
              code={`node -v          # v20 以上であること
ffmpeg -version  # 出力があること
git --version

# ComfyUI が起動しているか（200 が返ればOK）
curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:8188/`}
            />
          </div>
        </div>
      </section>

      {/* 手順 */}
      <section className="section">
        <div className="wrap">
          <div className="sec-head">
            <p className="eyebrow">セットアップ</p>
            <h2>5つの手順</h2>
            <p>手作業が必要なのは、実質「モデルを置く」ところだけです。</p>
          </div>

          <div className="steps">
            <div className="step">
              <div className="step-num">01</div>
              <div className="step-body">
                <h3>zip を入手して解凍する</h3>
                <p>
                  下のボタン、または GitHub の「Code › Download ZIP」から取得します。解凍すると
                  <code>forge-oss-main</code> フォルダができます。
                </p>
                <div className="hero-actions" style={{ marginTop: 4 }}>
                  <a className="btn btn-primary" href={ZIP_URL} style={{ padding: "11px 20px", fontSize: 14 }}>
                    zip をダウンロード
                  </a>
                  <a
                    className="btn btn-ghost"
                    href={REPO_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ padding: "11px 20px", fontSize: 14 }}
                  >
                    GitHub で見る
                  </a>
                </div>
              </div>
            </div>

            <div className="step">
              <div className="step-num">02</div>
              <div className="step-body">
                <h3>フォルダを Claude Code で開く</h3>
                <p>
                  Claude Code（claude.ai/code・CLI・IDE拡張のいずれか）で解凍したフォルダを開きます。
                  同梱の <code>CLAUDE.md</code> が導入手順の存在を自動で認識します。
                </p>
              </div>
            </div>

            <div className="step">
              <div className="step-num">03</div>
              <div className="step-body">
                <h3>「SETUP.md に沿って導入して」と伝える</h3>
                <p>あとはこの一言です。Claude Code が次を順に実行します。</p>
                <CodeBlock
                  code={`1. 前提チェック        # node / ffmpeg / ComfyUI:8188
2. npm install
3. .env.local を作成   # ComfyUI の場所だけ質問されます
4. public/media を作成 # 生成音声を配信するためのリンク
5. モデル配置の案内
6. npm run dev         # → http://localhost:3939`}
                />
              </div>
            </div>

            <div className="step">
              <div className="step-num">04</div>
              <div className="step-body">
                <h3>
                  モデルを置く <span className="pill-opt">唯一の手作業</span>
                </h3>
                <p>
                  歌モノの既定モデルを ComfyUI のフォルダに置きます。ファイル名は完全一致させてください
                  （アプリがこの名前で参照します）。ComfyUI Manager から取得するのが確実です。
                </p>
                <CodeBlock
                  code={`ComfyUI/models/checkpoints/
  ace_step_1.5_turbo_aio.safetensors   # 歌モノ既定（これだけで曲は作れます）
  ace_step_v1_3.5b.safetensors         # 声寄せ・LoRA（任意）
  stable-audio-open-1.0.safetensors    # SE・ループ（任意）
ComfyUI/models/text_encoders/t5-base.safetensors   # Stable Audio 用（任意）
ComfyUI/models/loras/                 # 自前LoRA（任意）`}
                />
              </div>
            </div>

            <div className="step">
              <div className="step-num">05</div>
              <div className="step-body">
                <h3>1曲つくって完了</h3>
                <p>
                  <code>http://localhost:3939</code> を開き、「かんたん」タブから1曲生成します。
                  ライブラリで再生できれば導入は成功です。
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 任意 */}
      <section className="section">
        <div className="wrap">
          <div className="sec-head">
            <p className="eyebrow">任意</p>
            <h2>あとから足せるもの</h2>
            <p>
              補助ツールは専用の環境に隔離してあります。すでに使っている ComfyUI や Python 環境に
              変更を加えることはありません。
            </p>
          </div>

          <div className="grid-cards">
            <div className="card">
              <span className="k">Separate</span>
              <h3>ステム分解（Demucs）</h3>
              <p>曲を6パートに分けます。専用の venv を作るので、既存環境とは混ざりません。</p>
              <CodeBlock
                code={`python -m venv tools/sep-venv
# Windows
tools/sep-venv/Scripts/pip install demucs
# mac / Linux
tools/sep-venv/bin/pip install demucs`}
              />
            </div>

            <div className="card">
              <span className="k">Voice</span>
              <h3>ナレーション（Irodori-TTS）</h3>
              <p>日本語の話し声とボイスクローン。ポート 8088 で別サーバーとして動かします。</p>
              <CodeBlock code={`npm run irodori   # → http://127.0.0.1:8088`} />
            </div>

            <div className="card">
              <span className="k">Auto</span>
              <h3>毎日の自動生成</h3>
              <p>常駐させると、設定した時刻に自動で新曲を作ってライブラリに追加します。</p>
              <CodeBlock code={`npm run scheduler`} />
            </div>
          </div>
        </div>
      </section>

      {/* 手動導入 */}
      <section className="section">
        <div className="wrap">
          <div className="sec-head">
            <p className="eyebrow">上級者向け</p>
            <h2>自分で入れる場合</h2>
            <p>Claude Code を使わずに導入する場合の最短手順です。</p>
          </div>
          <CodeBlock
            code={`npm install
cp .env.local.example .env.local
# .env.local の COMFY_OUTPUT / COMFY_INPUT を自分の ComfyUI のパスに書き換える

# 生成音声を配信するリンクを作る（Windows / PowerShell）
New-Item -ItemType Junction -Path public\\media -Target "<COMFY_OUTPUT の実パス>"
# mac / Linux
ln -s "<COMFY_OUTPUT の実パス>" public/media

npm run dev   # → http://localhost:3939`}
          />
          <p className="note-line">
            詳細な説明と全ステップは、リポジトリの{" "}
            <a href={`${REPO_URL}/blob/main/SETUP.md`} target="_blank" rel="noopener noreferrer">
              SETUP.md
            </a>{" "}
            に記載しています。
          </p>
        </div>
      </section>

      {/* トラブルシュート */}
      <section className="section">
        <div className="wrap">
          <div className="sec-head">
            <p className="eyebrow">困ったとき</p>
            <h2>よくあるつまずき</h2>
          </div>

          <div className="notes">
            <div className="note">
              <span className="i">◆</span>
              <div>
                <b>画面が 500 になる / Jest worker のエラーが出る</b>
                <br />
                開発サーバーの一時的なクラッシュです。プロセスを止め、<code>.next</code> を削除して
                起動し直すと直ります。
              </div>
            </div>
            <div className="note">
              <span className="i">◆</span>
              <div>
                <b>ポート 3939 が使用中（EADDRINUSE）</b>
                <br />
                すでに起動しています。ブラウザで開き直すか、掴んでいるプロセスを止めてから再起動してください。
              </div>
            </div>
            <div className="note">
              <span className="i">◆</span>
              <div>
                <b>音声が再生できない / 404 になる</b>
                <br />
                <code>public/media</code> のリンクが切れています。<code>.env.local</code> の
                <code>COMFY_OUTPUT</code> とリンク先が一致しているか確認してください。
              </div>
            </div>
            <div className="note">
              <span className="i">◆</span>
              <div>
                <b>生成が失敗する / モデルが見つからない</b>
                <br />
                モデルのファイル名が完全一致しているか、ComfyUI が 8188 で起動しているかを確認してください。
              </div>
            </div>
            <div className="note">
              <span className="i">◆</span>
              <div>
                <b>マスタリングや書き出しが失敗する</b>
                <br />
                FFmpeg が PATH に通っていない可能性があります（<code>ffmpeg -version</code> で確認）。
              </div>
            </div>
          </div>

          <div className="callout">
            まだ動かないときは、Claude Code に「エラーが出た」とそのまま伝えてください。
            <code>SETUP.md</code> のトラブルシュートに沿って原因を切り分けます。
          </div>

          <div style={{ marginTop: 24 }}>
            <Link className="btn btn-ghost" href="/specs">
              必要スペックとPCチェックを見る
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
