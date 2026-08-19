# 自分だけの音色モデル（ACE-Step LoRA）を作る

SoundForge の「音色モデル（LoRA）」に出てくる**自分専用のモデル**を学習する手順です。
学習は ComfyUI ではなく **ACE-Step 公式トレーナー**で行い、できあがった `.safetensors` を
`ComfyUI/models/loras/` に置くと、SoundForge の LoRA 選択肢に自動で出ます。

> RTX 4070(12GB) は 3.5B + LoRA には少しタイトです。下記の低VRAM設定（r=16, gradient
> checkpointing, bf16, batch=1）から始め、OOM が出たら `r` をさらに下げてください。
> どうしても厳しい場合はクラウドGPU(RunPod等)で学習→`.safetensors`だけ持ち帰る運用が確実です。

## 1. データセットを用意する

1曲につき **3ファイル** を同じ名前で置きます（`prepare_dataset.py` が自動生成を手伝います）。

```
training/data/
├── mysong_001.mp3          # 音源（10〜30秒のクリップ推奨）
├── mysong_001_prompt.txt   # カンマ区切りタグ
└── mysong_001_lyrics.txt   # 歌詞（インストは空でOK）
```

`*_prompt.txt` の例（SoundForge が作る tags と同じ書き方）:

```
city pop, female vocal, warm airy voice, electric guitar, 112 bpm, key of A minor
```

### 自分の声に寄せる LoRA を作りたい場合
`*_prompt.txt` に共通の**トリガー語**（例: `myvoice`）を必ず入れておくと、
生成時に `myvoice` と書くだけでその声が呼び出せます。素材は自分の歌唱や、
利用許諾のある音源だけを使ってください（実在人物の声の無断学習はしないこと）。

### 素材の下ごしらえ（任意・便利ツール）
長い音源を学習用クリップに刻み、3ファイル構成に整えます:

```bash
# 例: input/ の音源を24秒ごとに分割し、共通タグとトリガー語を付与
python training/prepare_dataset.py \
  --in training/input \
  --out training/data \
  --clip 24 \
  --tags "city pop, female vocal, warm" \
  --trigger myvoice
```

歌詞は各 `*_lyrics.txt` を後から手で埋めてください（インストなら空のまま）。

## 2. ACE-Step トレーナーを取得

```bash
git clone https://github.com/ace-step/ACE-Step
cd ACE-Step
pip install -e .
# 学習の詳細は同リポの TRAIN_INSTRUCTION.md も参照
```

## 3. HuggingFace形式に変換

```bash
python convert2hf_dataset.py \
  --data_dir "../music-start-dayo/training/data" \
  --repeat_count 2000 \
  --output_name "./my_lora_dataset"
```

`--repeat_count` は少数データを水増しする回数（数十曲なら 1000〜2000 目安）。

## 4. 学習する（低VRAM設定）

同梱の `training/config/lora_4070.json` を使います（r=16 / alpha=32）。

```bash
python trainer.py \
  --dataset_path "./my_lora_dataset" \
  --lora_config_path "../music-start-dayo/training/config/lora_4070.json" \
  --learning_rate 1e-4 \
  --max_steps 4000 \
  --devices 1
```

- まずは `--max_steps 2000〜4000` で試作 → 効きを見て増減。
- OOM のときは config の `"r"` を 8、`"lora_alpha"` を 16 に下げる／`gradient_checkpointing` を有効化。

## 5. ComfyUI に入れて SoundForge で使う

学習で出力された LoRA の `.safetensors` を次に置くだけ:

```
C:\Users\YOUR_NAME\ComfyUI_windows_portable\ComfyUI\models\loras\my_voice.safetensors
```

- ファイル名に `minimax/h3/wan/flux/sdxl/hunyuan/qwen` を**含めない**でください
  （SoundForge が動画用LoRAを除外するフィルタに引っかかります）。
- SoundForge のフルカスタム →「音色モデル（LoRA）」で選択 → 強さを調整して生成。
- トリガー語を入れた場合は、スタイルや歌詞にその語（例 `myvoice`）を入れると発動します。

> peft 形式のまま ComfyUI で読めない場合は、ACE-Step 側の変換/保存オプションで
> single-file safetensors として書き出してください（TRAIN_INSTRUCTION.md 参照）。
