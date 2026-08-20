# FORGE セットアップ手順（Claude Code 実行用ランブック）

> **Claude Code へ：** このファイルは、あなた（AIコーディングエージェント）がこのプロジェクトを
> ユーザーのPCで動かすために順番に実行する手順書です。上から順に進めてください。
> 各ステップには「確認コマンド」と「成功条件」があります。成功条件を満たしてから次へ進みます。
> 判断が必要な箇所（ComfyUIの場所など）はユーザーに1問ずつ質問してください。
> **ユーザーの本番 ComfyUI 環境は絶対に壊さないこと**（モデルの追加のみ。既存設定は変更しない）。

このアプリは「ローカル ComfyUI で音楽を生成 → 内蔵DAWで編集 → Luster で仕上げる」ローカル音楽制作スタジオです。
ポートは **3939**、ComfyUI は **8188** を使います。

---

## ステップ 0 — 全体像（先に読む）

必要なもの：
- **Node.js 20 以上**、**npm**
- **Python 3.10 以上**（ステム分解・ナレーションを使う場合）
- **FFmpeg**（マスタリング・編集・書き出しに必須）
- **Git**
- **ComfyUI**（`127.0.0.1:8188` で起動できること）＋ 音楽生成モデル

このzipに **含まれないもの**（サイズ・環境依存のため）とその入手方法：
- `node_modules/` → ステップ2の `npm install` で再生成
- 生成モデル（.safetensors, 数GB）→ ステップ5でダウンロード配置
- `tools/sep-venv`（Demucs用venv）→ ステップ7で作成（任意）
- `tools/Irodori-TTS-Server`（音声サーバー）→ ステップ7でclone（任意）
- `public/media`（ComfyUI output へのリンク）→ ステップ4で作成

---

## ステップ 1 — 前提の確認

```bash
node -v          # v20 以上であること
npm -v
ffmpeg -version  # 出力があること（なければ FFmpeg を入れる）
python --version # 3.10 以上（分解/音声を使う場合。使わないなら任意）
git --version
```

**成功条件：** `node -v` が v20+、`ffmpeg -version` が表示される。
- FFmpeg が無い場合：Windows は `winget install Gyan.FFmpeg` または https://ffmpeg.org 。mac は `brew install ffmpeg`。Linux は `apt install ffmpeg`。
- Node が古い/無い場合：https://nodejs.org（LTS）を案内。

**ComfyUI のバージョンについて（実際にはまった点）:**

使いたいモデルによって必要なバージョンが違います。古いままだと「ノードが出てこない」という形で詰まります。

| 使いたいもの | 必要な ComfyUI |
|---|---|
| ACE-Step（曲の生成） | 0.30 以降 |
| MiniMax-H3（動画） | 0.30 以降 |
| MiniMax-Music3（長尺の曲・任意） | **0.33.1 以降** |

更新は `update\update_comfyui.bat` が公式のやり方です。ただし **本体だけ更新すると `comfy_kitchen` などの Python パッケージが古いままで起動しなくなることがあります**（`AttributeError: module 'comfy_kitchen' has no attribute ...` というエラーが出ます）。

その場合は、依存を丸ごと更新する（torch まで入れ替わってしまう）のではなく、`ComfyUI/requirements.txt` に書かれているバージョンだけを狙って入れ直すのが安全です。

```bash
# 何が変わるか先に確認する（torch が対象に入っていないことを確かめる）
.\python_embeded\python.exe -m pip install --dry-run comfy-kitchen==0.2.31

# 問題なければ実行
.\python_embeded\python.exe -m pip install comfy-kitchen==0.2.31
```

更新の前に `ComfyUI/custom_nodes` と `ComfyUI/user` をコピーし、`git rev-parse HEAD` で現在のコミットを控えておくと、いつでも元に戻せます。

**ComfyUI の確認：**
```bash
curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:8188/
```
`200` が返れば起動済み。返らなければユーザーに「ComfyUI を起動してください」と伝える
（ComfyUI 自体の導入は範囲外。未導入なら https://github.com/comfyanonymous/ComfyUI を案内）。

---

## ステップ 2 — 依存パッケージのインストール

プロジェクトのルート（この `SETUP.md` があるフォルダ）で：

```bash
npm install
```

**成功条件：** エラーなく完了し、`node_modules/` が生成される。

---

## ステップ 3 — 環境設定ファイル `.env.local` を作る

`.env.local.example` を複製して `.env.local` を作り、**ComfyUI の output / input フォルダの実パス**を書き込みます。

1. ユーザーに質問：「ComfyUI の場所（フォルダ）はどこですか？」
   - 例(Windows portable): `C:\Users\<名前>\ComfyUI_windows_portable\ComfyUI`
   - 例(mac/Linux): `/home/<名前>/ComfyUI`
2. そのパス配下の `output` と `input` を `.env.local` に設定します。

```bash
cp .env.local.example .env.local
```

`.env.local` を編集し、`<あなたのComfyUI>` を実パスに置換：
```
COMFY_HOST=http://127.0.0.1:8188
COMFY_OUTPUT=<実パス>/output
COMFY_INPUT=<実パス>/input
DATA_DIR=./data
```

**成功条件：** `.env.local` が存在し、`COMFY_OUTPUT` に実在するフォルダが指定されている
（`ls "<COMFY_OUTPUT>"` が通ること）。

---

## ステップ 4 — 生成音声を配信するリンク `public/media` を作る

アプリは `public/media` 経由で ComfyUI の output フォルダの音声を配信します
（大きな音声を dev サーバーが直接返すとクラッシュするため、静的リンクで回避）。

**Windows（管理者不要のジャンクション）:**
```powershell
# 既存があれば消してから作成
if (Test-Path public\media) { Remove-Item public\media -Force -Recurse }
New-Item -ItemType Junction -Path public\media -Target "<COMFY_OUTPUT の実パス>"
```

**mac / Linux（シンボリックリンク）:**
```bash
rm -rf public/media
ln -s "<COMFY_OUTPUT の実パス>" public/media
```

**成功条件：** `ls public/media` で ComfyUI の output の中身が見えること。

---

## ステップ 5 — 生成モデルを配置

ComfyUI のモデルフォルダに、使うチェックポイントを置きます。**歌モノは ACE-Step 1.5 が既定**なので、
最低限これ1つがあれば曲は作れます。

| ファイル名 | 置き場所 | 用途 | 必須 |
|---|---|---|---|
| `ace_step_1.5_turbo_aio.safetensors` | `ComfyUI/models/checkpoints/` | 歌モノ（既定） | **必須** |
| `ace_step_v1_3.5b.safetensors` | `ComfyUI/models/checkpoints/` | 声寄せ・LoRA | 任意 |
| `stable-audio-open-1.0.safetensors` | `ComfyUI/models/checkpoints/` | SE・ループ | 任意 |
| `t5-base.safetensors` | `ComfyUI/models/text_encoders/` | Stable Audio 用 | 任意 |
| 自前 LoRA（`.safetensors`） | `ComfyUI/models/loras/` | 音色モデル | 任意 |

**入手方法：**
- **ComfyUI Manager**（推奨）でモデル検索してダウンロードするのが最も確実。
- または Hugging Face の **ACE-Step 公式リポジトリ**から上記ファイル名を取得。
- ファイル名は上表と**完全一致**させること（`lib/workflows.ts` がこの名前で参照）。

**成功条件：** `ls "<ComfyUI>/models/checkpoints/"` に `ace_step_1.5_turbo_aio.safetensors` がある。

---

## ステップ 6 — 起動して動作確認

```bash
npm run dev
```

別ターミナルで確認：
```bash
curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:3939/
```
`200` ならOK。ブラウザで **http://localhost:3939** を開く。

**生成テスト（任意・推奨）:** アプリの「かんたん」タブから1曲生成し、ライブラリで再生できれば導入成功。

**成功条件：** トップページが表示され、曲を1曲生成して再生できる。

---

## ステップ 7 — 補助ツール（任意）

### 7a. ステム分解（Demucs）
6パート（歌/ドラム/ベース/ギター/ピアノ/その他）に分解する機能。専用 venv を作ります
（**既存の Python 環境や ComfyUI の venv は使わない**）。

```bash
python -m venv tools/sep-venv
# Windows:
tools/sep-venv/Scripts/pip install demucs
# mac/Linux:
tools/sep-venv/bin/pip install demucs
```
`scripts/separate.py` が `tools/sep-venv` の python から実行されます。

### 7b. ナレーション（Irodori-TTS）
日本語の話し声・ボイスクローン。ポート **8088** で別サーバーとして動かします。

```bash
git clone <Irodori-TTS-Server のリポジトリ> tools/Irodori-TTS-Server
# 依存を入れて起動：
npm run irodori   # → http://127.0.0.1:8088
```
> ボイスクローンは **自分の声か、ライセンス済み音源のみ**。本人同意なく実在人物の声を模倣しないこと。

### 7c. 毎日の自動生成（スケジューラ）
```bash
npm run scheduler
```

---

## トラブルシュート

- **`http://localhost:3939` が 500 / "Jest worker encountered child process exceptions"**
  → dev サーバーの一時的クラッシュ。掴んでいるプロセスを止め、`.next` を消して再起動：
  ```bash
  # ポート3939を掴むPIDを止める → 例(Windows): taskkill //PID <pid> //F
  rm -rf .next
  npm run dev
  ```
- **音声が 404 / 再生できない** → `public/media` リンクが切れている（ステップ4をやり直す）。
  `.env.local` の `COMFY_OUTPUT` とリンク先が一致しているか確認。
- **`ポート 3939 が使用中 (EADDRINUSE)`** → 既に dev サーバーが起動している。既存のものを使うか、掴んでいるプロセスを止めてから再起動。
- **生成が FAILED / モデルが見つからない** → ステップ5のファイル名が完全一致しているか、ComfyUI が 8188 で起動しているか確認。
- **マスタリング/書き出しが失敗** → FFmpeg が PATH にあるか（`ffmpeg -version`）。

---

## 最終チェックリスト
- [ ] `node -v` ≥ 20 / `ffmpeg -version` OK
- [ ] `npm install` 完了
- [ ] `.env.local` に正しい `COMFY_OUTPUT`
- [ ] `public/media` が output を指す
- [ ] `ace_step_1.5_turbo_aio.safetensors` を配置
- [ ] `npm run dev` → http://localhost:3939 が表示
- [ ] 1曲生成して再生できた
