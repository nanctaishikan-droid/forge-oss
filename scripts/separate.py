# -*- coding: utf-8 -*-
"""Demucs で楽曲をステム分解する。tools/sep-venv の python から実行される。

  python scripts/separate.py --in "曲.mp3" --out "出力フォルダ" [--model htdemucs_6s]

htdemucs_6s = drums / bass / other / vocals / guitar / piano の6分割。
出力フォルダ直下に vocals.wav / drums.wav / bass.wav / guitar.wav / piano.wav / other.wav を並べる。
"""
import argparse
import os
import shutil
import subprocess
import sys
import tempfile


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--in", dest="inp", required=True)
    ap.add_argument("--out", dest="out", required=True)
    ap.add_argument("--model", default="htdemucs_6s")
    ap.add_argument("--shifts", type=int, default=2)   # test-time augmentation（大きいほど高品質・低速）
    ap.add_argument("--overlap", type=float, default=0.5)  # 窓の重なり（大きいほど繋ぎが自然）
    a = ap.parse_args()

    if not os.path.isfile(a.inp):
        print(f"入力が見つかりません: {a.inp}", file=sys.stderr)
        return 1
    os.makedirs(a.out, exist_ok=True)

    with tempfile.TemporaryDirectory() as tmp:
        # demucs 実行（CPU/GPUは torch 側に従う）
        cmd = [sys.executable, "-m", "demucs", "-n", a.model,
               "--shifts", str(a.shifts), "--overlap", str(a.overlap),
               "-o", tmp, a.inp]
        print("running:", " ".join(cmd), flush=True)
        r = subprocess.run(cmd)
        if r.returncode != 0:
            print("demucs 失敗", file=sys.stderr)
            return r.returncode

        # 出力は tmp/<model>/<trackname>/<stem>.wav
        model_dir = os.path.join(tmp, a.model)
        if not os.path.isdir(model_dir):
            print(f"出力ディレクトリなし: {model_dir}", file=sys.stderr)
            return 2
        # trackname フォルダは1つだけできる
        subdirs = [d for d in os.listdir(model_dir) if os.path.isdir(os.path.join(model_dir, d))]
        if not subdirs:
            print("分離結果なし", file=sys.stderr)
            return 3
        track_dir = os.path.join(model_dir, subdirs[0])

        moved = []
        for f in os.listdir(track_dir):
            if f.lower().endswith(".wav"):
                dst = os.path.join(a.out, f)
                shutil.move(os.path.join(track_dir, f), dst)
                moved.append(f)
        print("stems:", ",".join(sorted(moved)))
    return 0


if __name__ == "__main__":
    sys.exit(main())
