// 波形/スペクトログラム描画用の軽量DSP（クライアント）。

// 反復radix-2 FFT（in-place, 実部/虚部）
export function fft(re: Float32Array, im: Float32Array) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [re[i], re[j]] = [re[j], re[i]];
      [im[i], im[j]] = [im[j], im[i]];
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len;
    const wr = Math.cos(ang);
    const wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let cr = 1;
      let ci = 0;
      for (let k = 0; k < len / 2; k++) {
        const a = i + k;
        const b = i + k + len / 2;
        const tr = cr * re[b] - ci * im[b];
        const ti = cr * im[b] + ci * re[b];
        re[b] = re[a] - tr;
        im[b] = im[a] - ti;
        re[a] += tr;
        im[a] += ti;
        const ncr = cr * wr - ci * wi;
        ci = cr * wi + ci * wr;
        cr = ncr;
      }
    }
  }
}

// モノラル配列（全チャンネル平均）
export function toMono(buf: AudioBuffer): Float32Array {
  const ch = buf.numberOfChannels;
  const out = new Float32Array(buf.length);
  for (let c = 0; c < ch; c++) {
    const d = buf.getChannelData(c);
    for (let i = 0; i < d.length; i++) out[i] += d[i] / ch;
  }
  return out;
}

// 波形のmin/maxピークをcanvasに描画
export function drawWaveform(
  canvas: HTMLCanvasElement,
  mono: Float32Array,
  color: string,
  bg: string
) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const w = canvas.width;
  const h = canvas.height;
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);
  const step = Math.max(1, Math.floor(mono.length / w));
  const mid = h / 2;
  ctx.strokeStyle = color;
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = 0; x < w; x++) {
    let min = 1;
    let max = -1;
    const start = x * step;
    for (let i = 0; i < step; i++) {
      const v = mono[start + i] || 0;
      if (v < min) min = v;
      if (v > max) max = v;
    }
    ctx.moveTo(x + 0.5, mid - max * mid * 0.95);
    ctx.lineTo(x + 0.5, mid - min * mid * 0.95);
  }
  ctx.stroke();
  // 中央線
  ctx.strokeStyle = "rgba(255,255,255,0.08)";
  ctx.beginPath();
  ctx.moveTo(0, mid);
  ctx.lineTo(w, mid);
  ctx.stroke();
}

// スペクトログラム（x=時間, y=周波数）を描画。fftSizeは2の冪。
export function drawSpectrogram(
  canvas: HTMLCanvasElement,
  mono: Float32Array,
  sampleRate: number,
  fftSize = 1024
) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const w = canvas.width;
  const h = canvas.height;
  const cols = w;
  const hop = Math.max(1, Math.floor((mono.length - fftSize) / cols));
  const half = fftSize / 2;

  // Hann窓
  const win = new Float32Array(fftSize);
  for (let i = 0; i < fftSize; i++)
    win[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (fftSize - 1)));

  const img = ctx.createImageData(w, h);
  const data = img.data;
  const re = new Float32Array(fftSize);
  const im = new Float32Array(fftSize);
  const minDb = -90;
  const maxDb = -20;

  for (let x = 0; x < cols; x++) {
    const off = x * hop;
    for (let i = 0; i < fftSize; i++) {
      re[i] = (mono[off + i] || 0) * win[i];
      im[i] = 0;
    }
    fft(re, im);
    for (let y = 0; y < h; y++) {
      // 対数周波数スケール（下=低域, 上=高域）
      const frac = 1 - y / h;
      const bin = Math.min(half - 1, Math.floor(Math.pow(frac, 2.0) * (half - 1)));
      const mag = Math.hypot(re[bin], im[bin]) / half;
      let db = 20 * Math.log10(mag + 1e-9);
      let t = (db - minDb) / (maxDb - minDb);
      t = Math.max(0, Math.min(1, t));
      // 黒→オレンジ→白のカラーマップ
      const r = Math.min(255, t * 3 * 255);
      const g = Math.min(255, Math.max(0, (t - 0.33) * 3) * 180 + t * 40);
      const b = Math.min(255, Math.max(0, (t - 0.7) * 3.3) * 255);
      const idx = (y * w + x) * 4;
      data[idx] = r;
      data[idx + 1] = g;
      data[idx + 2] = b;
      data[idx + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
}
