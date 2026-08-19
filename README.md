<div align="center">

# 🔥 FORGE

**ローカルGPUで動く、音楽制作スタジオ。**

生成 → 編集 → 仕上げまで、すべてあなたのPCの中で。クラウドの月間上限もアップロードもありません。

![Next.js](https://img.shields.io/badge/Next.js-15-black) ![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178c6) ![License](https://img.shields.io/badge/License-MIT-46d39a) ![Runs on](https://img.shields.io/badge/runs%20on-your%20GPU-ff6a1a)

[**▶ デモ・紹介ページ（曲が聴けます）**](https://claude.ai/code/artifact/a165b7db-e997-4514-b18b-fd076cfd3016)

</div>

---

## これは何？

FORGE は、手元の **ComfyUI**（ローカルの画像・動画・音楽生成基盤）を使って、
曲をフルカスタムに **生成 → 編集 → マスタリング** するための自前スタジオです。
Next.js 製の Web アプリで、ブラウザから操作します。

- **生成**: ACE-Step 1.5（歌モノが安定・既定）/ ACE-Step v1（声寄せ・LoRA）/ Stable Audio Open（SE・ループ）
- **編集**: 内蔵のマルチトラック・エディタ（波形＋クリップ編集）
- **仕上げ**: Luster マスタリング（EBU R128 ラウドネス正規化・True Peak 制御）
- **分解**: Demucs で 6 パートにステム分離
- **音声**: Irodori-TTS で日本語ナレーション・ボイスクローン

> クラウド版と違い、モデルもデータも生成もすべてローカル。生成回数に上限はありません（=あなたのGPU次第）。

---

## ✨ 主な機能

| 機能 | 内容 |
|---|---|
| 🎵 **生成** | かんたん / フルカスタムの2モード。歌詞（`[verse]`/`[chorus]` 構造タグ対応）・スタイル・ボーカル（性別/年齢/声質/言語）・楽器バランス・BPM・キー・ステップ・CFG を指定。 |
| 🎚️ **マスタリング** | そのまま / 大きく・迫力 / クリア・繊細 ＋ カスタム。違いをメーター＋説明で可視化し、A/B 比較も可能。48kHz/24bit WAV で書き出し。 |
| 🌊 **マルチトラック編集** | 波形表示、クリップの分割・移動・複製・リサイズ、クリップ毎のゲイン／フェード、トラックのパン、リアルタイム・レベルメーター、EQ・コンプ・リバーブ・音量オートメーション。全画面・ノースクロール設計。 |
| 🎛️ **ステム分解** | 曲を歌／ドラム／ベース／ギター／ピアノ／その他の6パートへ分離し、パート単位で調整・クリーンアップ・リミックス。 |
| 🎙️ **ナレーション** | 日本語の話し声を生成。絵文字で感情制御、参照音声から自分の声にクローンも。 |
| 💿 **アルバム管理** | カバー・曲名・曲順を管理し、連番ファイル＋カバー＋曲目リストでフォルダ書き出し。 |
| 🎨 **音色モデル (LoRA)** | 自前 LoRA を学習して追加可能（[training/](training/) 参照）。 |

---

## 🚀 クイックスタート

このリポジトリは **Claude Code（AIコーディングエージェント）に渡すだけ**で導入できるよう作られています。

1. リポジトリを取得（`git clone` または **Code › Download ZIP**）
2. フォルダを **Claude Code** で開く（同梱の [`CLAUDE.md`](CLAUDE.md) が導入手順を自動認識）
3. **「SETUP.md に沿って導入して」** と伝える

すると、前提チェック → `npm install` → `.env.local` 作成 → `public/media` リンク作成 → モデル配置の案内 → 起動 まで、確認しながら自動で進みます。手作業はモデル配置だけです。

<details>
<summary>自分で入れる場合（手動）</summary>

```bash
npm install
cp .env.local.example .env.local   # COMFY_OUTPUT / COMFY_INPUT を自分のComfyUIパスに
# public/media を ComfyUI の output へリンク（SETUP.md ステップ4参照）
npm run dev                        # → http://localhost:3939
```
詳細な手順・トラブルシュートは [**SETUP.md**](SETUP.md) にすべて記載しています。
</details>

---

## 🖥️ 最低スペック（目安）

派手なPCは不要です。ポイントは **NVIDIA GPU の VRAM** だけ。

| 項目 | 最低ライン |
|---|---|
| GPU | NVIDIA GeForce（**VRAM 8GB** 〜）例: GTX 1070 / RTX 3050 / RTX 3060 |
| VRAM | 8GB（6GB でも省メモリ設定で可。GPUなし=CPUのみでも動くが低速） |
| メモリ | 16GB |
| ストレージ | SSD 20GB 空き（モデル込） |
| CPU | 4コア |
| OS | Windows 10 / 11（mac・Linux も ComfyUI 次第で可） |
| 依存 | Node.js 20+ ／ FFmpeg ／ Git ／ ComfyUI（分解・音声を使うなら Python 3.10+） |

> VRAM が多いほど生成が速くなる、というだけの話です。参考: RTX 4070 で 150 秒の曲が約 2 分。

---

## 🧩 構成

```
app/
  music-studio/        … 生成UI（かんたん / フルカスタム, ライブラリ, アルバム）
  editor/[id]/         … マルチトラック・エディタ
  help/                … 使い方・ヘルプ
  api/music-studio/    … 生成/履歴/マスタリング/分解/リミックス/編集/ナレーション ほか
lib/
  comfy / workflows / presets / generate … 生成ロジックと ComfyUI クライアント
  master / stems / edit / remake          … 仕上げ・分解・編集・audio2audio
  luster/                                 … 取り込んだ Luster マスタリングエンジン
scripts/
  scheduler.mjs        … 毎日の自動生成（常駐・任意）
  separate.py          … Demucs 実行（専用venv）
training/              … 自前LoRAの学習手順
```

### 開発コマンド
```bash
npm run dev        # 開発サーバー（:3939）
npm run build      # 本番ビルド
npm test           # Luster マスタリングの契約テスト（音の処理を変えたら必ず通す）
npm run scheduler  # 毎日の自動生成（任意）
npm run irodori    # Irodori-TTS サーバー起動（:8088・任意）
```

---

## ⚖️ ライセンスと約束

- 本リポジトリのアプリコードは **MIT License**（[LICENSE](LICENSE)）。
- **本番の ComfyUI 環境を壊さない設計**: ステム分解(Demucs)・音声(Irodori)は専用 venv / 別 clone に隔離し、既存環境にはインストール・変更を加えません。
- **ボイスクローンは、自分の声かライセンス済み音源のみ**に使ってください。本人の同意なく実在人物の声を模倣する用途には使わないでください。

### サードパーティ / モデルのライセンス（各自ご確認ください）
| 構成要素 | 提供元・ライセンス（要確認） |
|---|---|
| ACE-Step | Apache-2.0（商用可） |
| Stable Audio Open | Stability AI Community License（年商 $1M 未満は商用可） |
| Demucs (htdemucs_6s) | Meta / MIT |
| Irodori-TTS | 各配布元のライセンスに従う |
| Luster（マスタリングエンジン） | 元配布物のライセンスに従う |

> 生成モデルの重み（.safetensors）はサイズと配布条件のため本リポジトリには含みません。入手方法は [SETUP.md](SETUP.md) を参照してください。

---

<div align="center">
<sub>FORGE · ローカル音楽制作スタジオ · Next.js + ComfyUI · すべて手元のGPUで</sub>
</div>
