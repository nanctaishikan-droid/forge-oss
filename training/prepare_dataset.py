# -*- coding: utf-8 -*-
"""ACE-Step LoRA 用データセットの下ごしらえ。

入力フォルダの音源を一定秒数で分割し、1クリップ = 3ファイル
(name.mp3 / name_prompt.txt / name_lyrics.txt) の形に整える。

  python training/prepare_dataset.py \
      --in training/input --out training/data \
      --clip 24 --tags "city pop, female vocal, warm" --trigger myvoice

- --clip 0 で分割せずそのままコピー
- 歌詞(*_lyrics.txt)は空で作られるので、後から手で埋める（インストは空のままでOK）
- ffmpeg が必要
"""
import argparse
import json
import os
import subprocess
import sys

AUDIO_EXTS = {".mp3", ".wav", ".flac", ".m4a", ".ogg", ".opus"}


def duration_sec(path: str) -> float:
    try:
        out = subprocess.run(
            ["ffprobe", "-v", "error", "-show_entries", "format=duration",
             "-of", "json", path],
            capture_output=True, text=True,
        )
        return float(json.loads(out.stdout)["format"]["duration"])
    except Exception:
        return 0.0


def write_sidecars(out_dir: str, stem: str, tags: str, trigger: str) -> None:
    tag_line = tags.strip()
    if trigger:
        # トリガー語を先頭に（無ければ付ける）
        parts = [t.strip() for t in tag_line.split(",") if t.strip()]
        if trigger not in parts:
            parts.insert(0, trigger)
        tag_line = ", ".join(parts)
    with open(os.path.join(out_dir, f"{stem}_prompt.txt"), "w", encoding="utf-8") as f:
        f.write(tag_line + "\n")
    # 歌詞は空ファイルを用意（後で埋める）
    lyr = os.path.join(out_dir, f"{stem}_lyrics.txt")
    if not os.path.exists(lyr):
        open(lyr, "w", encoding="utf-8").close()


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--in", dest="indir", required=True)
    ap.add_argument("--out", dest="outdir", required=True)
    ap.add_argument("--clip", type=float, default=24.0, help="分割秒数(0で分割なし)")
    ap.add_argument("--tags", default="", help="全クリップ共通のカンマ区切りタグ")
    ap.add_argument("--trigger", default="", help="トリガー語(自分の声/音色を呼び出す語)")
    a = ap.parse_args()

    os.makedirs(a.outdir, exist_ok=True)
    srcs = [
        os.path.join(a.indir, f)
        for f in os.listdir(a.indir)
        if os.path.splitext(f)[1].lower() in AUDIO_EXTS
    ]
    if not srcs:
        print(f"音源が見つかりません: {a.indir}")
        return 1

    total = 0
    for src in sorted(srcs):
        base = os.path.splitext(os.path.basename(src))[0]
        safe = "".join(c if c.isalnum() or c in "-_" else "_" for c in base)

        if a.clip and a.clip > 0:
            dur = duration_sec(src)
            n = max(1, int(dur // a.clip))
            for i in range(n):
                start = i * a.clip
                stem = f"{safe}_{i:03d}"
                dst = os.path.join(a.outdir, f"{stem}.mp3")
                subprocess.run(
                    ["ffmpeg", "-y", "-ss", str(start), "-t", str(a.clip),
                     "-i", src, "-ar", "44100", "-ac", "2", "-b:a", "192k", dst],
                    capture_output=True,
                )
                write_sidecars(a.outdir, stem, a.tags, a.trigger)
                total += 1
        else:
            stem = safe
            dst = os.path.join(a.outdir, f"{stem}.mp3")
            subprocess.run(
                ["ffmpeg", "-y", "-i", src, "-ar", "44100", "-ac", "2",
                 "-b:a", "192k", dst],
                capture_output=True,
            )
            write_sidecars(a.outdir, stem, a.tags, a.trigger)
            total += 1

    print(f"完了: {total} クリップを {a.outdir} に作成しました。")
    print("次: 各 *_lyrics.txt に歌詞を記入（インストは空のまま）→ ACE-Step で変換・学習。")
    return 0


if __name__ == "__main__":
    sys.exit(main())
