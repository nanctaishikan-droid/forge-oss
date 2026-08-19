# CLAUDE.md — FORGE（ローカル音楽制作スタジオ）

このファイルは Claude Code（claude.ai/code）向けのプロジェクト指示です。

## 🚀 はじめての導入（重要）

**このプロジェクトがまだセットアップされていない場合**（`node_modules/` や `.env.local` が無い、
`npm run dev` が通らない等）は、まず **[`SETUP.md`](SETUP.md) を上から順に実行**してください。
zip を渡されただけの状態から、動く状態まで持っていくための手順書です。

判断が必要な箇所（ComfyUI の場所など）は、ユーザーに1問ずつ確認してください。
**ユーザーの本番 ComfyUI 環境は壊さないこと**（モデル追加のみ／既存設定は変更しない／
補助ツールは専用 venv・別 clone に隔離）。

## 会話・記述のルール
- 常に日本語で会話する（技術説明・コメント・ドキュメントも日本語）
- コード内コメントは日本語で記述
- エラーメッセージの解説も日本語で

## このアプリの概要
- **ポート**: アプリ=3939、ComfyUI=8188、Irodori-TTS=8088
- **生成**: ローカル ComfyUI（ACE-Step 1.5 既定 / ACE-Step v1 / Stable Audio Open）
- **編集**: 内蔵DAW（`/editor/[id]`）— クリップ編集・フェード・パン・レベルメーター・EQ/コンプ/リバーブ・オートメーション
- **仕上げ**: Luster マスタリング（`lib/luster/`、FFmpeg必須）
- **分解**: Demucs（`tools/sep-venv`、6ステム）
- **音声**: Irodori-TTS（別サーバー :8088）

## 開発コマンド
```bash
npm run dev        # 開発サーバー（:3939）
npm run build      # 本番ビルド
npm test           # Luster マスタリングの契約テスト（音の処理を変えたら必ず通す）
npm run scheduler  # 毎日の自動生成（常駐・任意）
npm run irodori    # Irodori-TTS サーバー起動（:8088・任意）
```

## 構成（詳細は README.md）
```
app/          … UI（music-studio）・DAWエディタ（editor）・API（api/music-studio/*）
lib/          … comfy / workflows / presets / generate / master / stems / store / luster
scripts/      … scheduler.mjs（自動生成）/ separate.py（Demucs実行）
training/     … 自前LoRAの学習手順
```

## 触るときの注意
- 音の処理（`lib/luster/` や FFmpeg フィルタ）を変えたら `npm test` を通す。
- 大きな音声を dev が直接返すとクラッシュするため、配信は `public/media`（ComfyUI output へのリンク）経由。
- dev サーバーが 500 / "Jest worker" で落ちたら、`.next` を消して再起動（`SETUP.md` のトラブルシュート参照）。
