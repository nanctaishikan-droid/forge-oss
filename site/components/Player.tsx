"use client";
// デモ曲プレーヤー。実音源から抽出した波形ピークを描き、
// 再生中はアナライザーの周波数エネルギーでバーを脈動させる。
import { useCallback, useEffect, useRef, useState } from "react";
import { PEAKS } from "@/lib/peaks";
import { SONG } from "@/lib/song";

const COLOR_IDLE = "#3a3a42";
const COLOR_ACCENT = "#ff6a1a";
const COLOR_EMBER = "#ffb04a";
const COLOR_PLAYED = "#ff8a3d";

function fmt(sec: number): string {
  const s = Math.max(0, Math.floor(sec || 0));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export function Player() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const freqRef = useRef<Uint8Array | null>(null);
  const rafRef = useRef<number | null>(null);

  const [playing, setPlaying] = useState(false);
  const [cur, setCur] = useState(0);
  const [dur, setDur] = useState(SONG.seconds);
  const [showLyrics, setShowLyrics] = useState(false);

  // 波形の描画（再生中は analyser のエネルギーを混ぜる）
  const draw = useCallback(() => {
    const cv = canvasRef.current;
    const audio = audioRef.current;
    if (!cv || !audio) return;
    const g = cv.getContext("2d");
    if (!g) return;

    const w = cv.clientWidth;
    const h = cv.clientHeight;
    g.clearRect(0, 0, w, h);

    const analyser = analyserRef.current;
    const freq = freqRef.current;
    const live = !audio.paused && analyser && freq;
    if (live) analyser.getByteFrequencyData(freq);

    const n = PEAKS.length;
    const bw = w / n;
    const mid = h / 2;
    const frac = audio.duration ? audio.currentTime / audio.duration : 0;

    for (let i = 0; i < n; i++) {
      const base = PEAKS[i];
      let bh: number;
      if (live) {
        const fi = Math.floor((i / n) * freq!.length * 0.7);
        const energy = freq![fi] / 255;
        bh = Math.max(2, (base * 0.55 + energy * 0.55) * (h * 0.94));
      } else {
        bh = Math.max(2, base * (h * 0.9));
      }
      const played = i / n <= frac;
      if (played && live) {
        const grad = g.createLinearGradient(0, mid - bh / 2, 0, mid + bh / 2);
        grad.addColorStop(0, COLOR_EMBER);
        grad.addColorStop(1, COLOR_ACCENT);
        g.fillStyle = grad;
      } else {
        g.fillStyle = played ? COLOR_PLAYED : COLOR_IDLE;
      }
      g.fillRect(i * bw + 0.5, mid - bh / 2, Math.max(1, bw - 1.5), bh);
    }
  }, []);

  // 再生中だけアニメーションを回す
  useEffect(() => {
    if (!playing) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      draw();
      return;
    }
    const loop = () => {
      draw();
      const a = audioRef.current;
      if (a) setCur(a.currentTime);
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
  }, [playing, draw]);

  // キャンバスの解像度合わせ（Retina対応）＋リサイズ追従
  useEffect(() => {
    const resize = () => {
      const cv = canvasRef.current;
      if (!cv) return;
      const g = cv.getContext("2d");
      if (!g) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      cv.width = Math.round(cv.clientWidth * dpr);
      cv.height = Math.round(cv.clientHeight * dpr);
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      draw();
    };
    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, [draw]);

  // 初回再生時にだけ Web Audio のグラフを組む
  const ensureGraph = () => {
    if (ctxRef.current || !audioRef.current) return;
    const AC: typeof AudioContext =
      window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ac = new AC();
    const src = ac.createMediaElementSource(audioRef.current);
    const an = ac.createAnalyser();
    an.fftSize = 512;
    src.connect(an);
    an.connect(ac.destination);
    ctxRef.current = ac;
    analyserRef.current = an;
    freqRef.current = new Uint8Array(an.frequencyBinCount);
  };

  const toggle = () => {
    const a = audioRef.current;
    if (!a) return;
    if (a.paused) {
      ensureGraph();
      void ctxRef.current?.resume();
      void a.play();
    } else {
      a.pause();
    }
  };

  const seek = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const a = audioRef.current;
    const cv = canvasRef.current;
    if (!a || !cv || !a.duration) return;
    const r = cv.getBoundingClientRect();
    a.currentTime = ((e.clientX - r.left) / r.width) * a.duration;
    setCur(a.currentTime);
    draw();
  };

  const lyricLines = SONG.lyrics.split("\n");

  return (
    <div className="player">
      <div className="player-head">
        <div className="player-title">
          <strong>{SONG.title}</strong>
          <span>GENERATED LOCALLY · SEED {SONG.seed}</span>
        </div>
        <div className="badges">
          {SONG.badges.map((b) => (
            <span className="badge" key={b}>
              {b}
            </span>
          ))}
        </div>
      </div>

      <div className="transport">
        <button
          className="play-btn"
          onClick={toggle}
          aria-label={playing ? "一時停止" : "デモ曲を再生"}
        >
          {playing ? (
            <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M6 5h4v14H6zM14 5h4v14h-4z" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M8 5v14l11-7z" />
            </svg>
          )}
        </button>

        <div className="wavebox">
          <canvas
            ref={canvasRef}
            className="wave"
            onClick={seek}
            role="slider"
            aria-label="再生位置"
            aria-valuemin={0}
            aria-valuemax={Math.round(dur)}
            aria-valuenow={Math.round(cur)}
            tabIndex={0}
          />
          <div className="timerow">
            <span>{fmt(cur)}</span>
            <span>{fmt(dur)}</span>
          </div>
        </div>
      </div>

      <button
        className="lyr-toggle"
        onClick={() => setShowLyrics((v) => !v)}
        aria-expanded={showLyrics}
      >
        <span>{showLyrics ? "歌詞を閉じる" : "歌詞を見る（オリジナル）"}</span>
        <span>{showLyrics ? "▴" : "▾"}</span>
      </button>

      {showLyrics && (
        <div className="lyrics">
          <pre>
            {lyricLines.map((line, i) => {
              const m = line.match(/^\[(.+)\]$/);
              return m ? (
                <span className="sect" key={i}>
                  {m[1].toUpperCase()}
                  {"\n"}
                </span>
              ) : (
                <span key={i}>
                  {line}
                  {"\n"}
                </span>
              );
            })}
          </pre>
        </div>
      )}

      <audio
        ref={audioRef}
        src={SONG.src}
        preload="metadata"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => {
          setPlaying(false);
          setCur(0);
        }}
        onTimeUpdate={(e) => setCur(e.currentTarget.currentTime)}
        onLoadedMetadata={(e) => {
          const d = e.currentTarget.duration;
          if (isFinite(d)) setDur(d);
        }}
      />
    </div>
  );
}
