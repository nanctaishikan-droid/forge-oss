"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { toMono, drawWaveform } from "@/lib/dsp";
import { Play, Pause, Download, Chevron, Layers, Sliders, X } from "@/components/icons";
import { Tip, HelpBadge } from "@/components/tooltip";

interface Region {
  start: number;
  end: number;
  gain: number;
  fade?: "in" | "out";
}

interface Clip {
  id: string;
  srcStart: number;
  srcDur: number;
  offset: number;
  gain: number;
  fadeIn?: number;
  fadeOut?: number;
  mute?: boolean;
}

// トラック定義（分解した6パート）
const TRACKS = [
  { id: "vocals", label: "ボーカル", color: "#f97316" },
  { id: "drums", label: "ドラム", color: "#ef4444" },
  { id: "bass", label: "ベース", color: "#a855f7" },
  { id: "guitar", label: "ギター", color: "#22c55e" },
  { id: "piano", label: "ピアノ", color: "#3b82f6" },
  { id: "other", label: "その他", color: "#94a3b8" },
] as const;

type Eq3 = { low: number; mid: number; high: number };
const FLAT: Eq3 = { low: 0, mid: 0, high: 0 };

function fmt(t: number) {
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}
const dbToGain = (db: number) => Math.pow(10, db / 20);
// 簡易リバーブ用の合成インパルス応答（減衰ノイズ）
function makeIR(ctx: AudioContext, seconds = 1.6): AudioBuffer {
  const len = Math.floor(ctx.sampleRate * seconds);
  const ir = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = ir.getChannelData(ch);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.5);
  }
  return ir;
}

interface TrackNodes {
  srcs: AudioBufferSourceNode[];
  gain: GainNode;
  eq: BiquadFilterNode[];
  pan: StereoPannerNode | null;
  analyser: AnalyserNode | null;
}

export default function EditorPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = params.id;

  const [title, setTitle] = useState("");
  const [stemsId, setStemsId] = useState<string | null>(null);
  const [stemUrls, setStemUrls] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [separating, setSeparating] = useState(false);

  const [buffers, setBuffers] = useState<Record<string, AudioBuffer>>({});
  const [duration, setDuration] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [cursor, setCursor] = useState(0);

  // パート別
  const [gains, setGains] = useState<Record<string, number>>({});
  const [mutes, setMutes] = useState<Record<string, boolean>>({});
  const [solos, setSolos] = useState<Record<string, boolean>>({});
  const [eqs, setEqs] = useState<Record<string, Eq3>>({});
  const [comps, setComps] = useState<Record<string, boolean>>({});
  const [reverbs, setReverbs] = useState<Record<string, number>>({});
  const [pans, setPans] = useState<Record<string, number>>({});
  const [selected, setSelected] = useState<string>("vocals");

  // 区間編集（範囲を絞る/ミュート）
  const [regions, setRegions] = useState<Record<string, Region[]>>({});
  const [sel, setSel] = useState<{ stem: string; start: number; end: number } | null>(null);
  const dragRef = useRef<{ stem: string; startFrac: number } | null>(null);
  const rDragRef = useRef<{
    stem: string;
    idx: number;
    laneW: number;
    startX: number;
    origStart: number;
    origEnd: number;
  } | null>(null);

  // 音量オートメーション
  const [autoMode, setAutoMode] = useState(false);
  const [autos, setAutos] = useState<Record<string, { t: number; v: number }[]>>({});
  const autoDragRef = useRef<{ stem: string; idx: number } | null>(null);
  const AUTO_MAX = 1.5; // v の最大（+3.5dB相当）

  const [pxPerSec, setPxPerSec] = useState(50); // タイムラインの横ズーム
  const [bpm, setBpm] = useState(120);
  const [snap, setSnap] = useState(true);
  const [showMixer, setShowMixer] = useState(false);
  // クリップ編集
  const [clipMode, setClipMode] = useState(false);
  const [clips, setClips] = useState<Record<string, Clip[]>>({});
  const monoRef = useRef<Record<string, Float32Array>>({});
  const clipDragRef = useRef<{ stem: string; id: string; laneW: number; startX: number; orig: number } | null>(null);
  const [selClip, setSelClip] = useState<{ stem: string; id: string } | null>(null);
  const meterRefs = useRef<Record<string, HTMLSpanElement | null>>({});
  const meterRafRef = useRef<number | null>(null);
  const clipCounter = useRef(1);

  // 全体
  const [trimStart, setTrimStart] = useState(0);
  const [trimEnd, setTrimEnd] = useState(0);
  const [fadeIn, setFadeIn] = useState(0);
  const [fadeOut, setFadeOut] = useState(0);
  const [masterVol, setMasterVol] = useState(0);

  const [exporting, setExporting] = useState(false);
  const [mixUrl, setMixUrl] = useState<string | null>(null);

  // Undo / Redo
  const histRef = useRef<string[]>([]);
  const idxRef = useRef(-1);
  const restoringRef = useRef(false);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  const canvasRefs = useRef<Record<string, HTMLCanvasElement | null>>({});
  const ctxRef = useRef<AudioContext | null>(null);
  const nodesRef = useRef<Record<string, TrackNodes>>({});
  const masterRef = useRef<GainNode | null>(null);
  const startedAtRef = useRef(0);
  const offsetRef = useRef(0);
  const rafRef = useRef<number | null>(null);
  const irRef = useRef<AudioBuffer | null>(null);

  const availableStems = TRACKS.filter((t) => stemUrls[t.id]);
  const anySolo = Object.values(solos).some(Boolean);

  // ジョブ取得
  useEffect(() => {
    (async () => {
      try {
        const r = await fetch(`/api/music-studio/jobs?id=${encodeURIComponent(id)}`, {
          cache: "no-store",
        });
        if (!r.ok) throw new Error("曲が見つかりません");
        const j = (await r.json()).job;
        setTitle(j.title);
        if (j.stems && j.stemsId) {
          setStemsId(j.stemsId);
          setStemUrls(j.stems);
        }
        setLoading(false);
      } catch (e) {
        setError(String(e));
        setLoading(false);
      }
    })();
  }, [id]);

  // ステム分離を実行
  const runSeparate = async () => {
    setSeparating(true);
    setError(null);
    try {
      const r = await fetch("/api/music-studio/stems", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId: id }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "分解失敗");
      setStemsId(d.stemsId);
      setStemUrls(d.stems);
    } catch (e) {
      setError(String(e));
    } finally {
      setSeparating(false);
    }
  };

  // 全ステムをデコード
  useEffect(() => {
    if (Object.keys(stemUrls).length === 0) return;
    let cancelled = false;
    (async () => {
      try {
        const AC = window.AudioContext || (window as any).webkitAudioContext;
        const ctx: AudioContext = ctxRef.current || new AC();
        ctxRef.current = ctx;
        const out: Record<string, AudioBuffer> = {};
        for (const t of TRACKS) {
          const url = stemUrls[t.id];
          if (!url) continue;
          const ab = await (await fetch(url)).arrayBuffer();
          out[t.id] = await ctx.decodeAudioData(ab);
        }
        if (cancelled) return;
        setBuffers(out);
        const dur = Math.max(...Object.values(out).map((b) => b.duration));
        setDuration(dur);
        setTrimEnd(dur);
        // mono キャッシュ & クリップ初期化（1トラック=1クリップ）
        const mono: Record<string, Float32Array> = {};
        const initClips: Record<string, Clip[]> = {};
        for (const t of TRACKS) {
          const b = out[t.id];
          if (!b) continue;
          mono[t.id] = toMono(b);
          initClips[t.id] = [
            { id: `c${clipCounter.current++}`, srcStart: 0, srcDur: b.duration, offset: 0, gain: 0 },
          ];
        }
        monoRef.current = mono;
        setClips(initClips);
      } catch (e) {
        setError(`ステムの読み込みに失敗: ${String(e)}`);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [stemUrls]);

  // 波形描画
  useEffect(() => {
    for (const t of TRACKS) {
      const buf = buffers[t.id];
      const cv = canvasRefs.current[t.id];
      if (buf && cv) drawWaveform(cv, toMono(buf), t.color, "#0f0f11");
    }
  }, [buffers]);

  const runMeters = useCallback(() => {
    const buf = new Uint8Array(256);
    Object.entries(nodesRef.current).forEach(([stem, n]) => {
      const el = meterRefs.current[stem];
      if (!n.analyser || !el) return;
      n.analyser.getByteTimeDomainData(buf);
      let sum = 0;
      for (let i = 0; i < buf.length; i++) {
        const v = (buf[i] - 128) / 128;
        sum += v * v;
      }
      const rms = Math.sqrt(sum / buf.length);
      el.style.height = `${Math.min(100, rms * 180).toFixed(0)}%`;
    });
    meterRafRef.current = requestAnimationFrame(runMeters);
  }, []);

  const stopPlayback = useCallback(() => {
    Object.values(nodesRef.current).forEach((n) => {
      n.srcs.forEach((sc) => {
        try {
          sc.stop();
        } catch {}
        sc.disconnect();
      });
    });
    nodesRef.current = {};
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    if (meterRafRef.current) cancelAnimationFrame(meterRafRef.current);
    meterRafRef.current = null;
    Object.values(meterRefs.current).forEach((el) => {
      if (el) el.style.height = "0%";
    });
    setPlaying(false);
  }, []);

  const trackGainValue = useCallback(
    (stem: string) => {
      if (mutes[stem]) return 0;
      if (anySolo && !solos[stem]) return 0;
      return dbToGain(gains[stem] ?? 0);
    },
    [mutes, solos, gains, anySolo]
  );

  const play = useCallback(
    (from?: number, onlyStem?: string) => {
      const ctx = ctxRef.current;
      if (!ctx) return;
      stopPlayback();
      ctx.resume();
      const master = ctx.createGain();
      master.gain.value = dbToGain(masterVol);
      master.connect(ctx.destination);
      masterRef.current = master;

      const off = from ?? cursor;
      offsetRef.current = off;
      startedAtRef.current = ctx.currentTime;

      for (const t of TRACKS) {
        const buf = buffers[t.id];
        if (!buf) continue;
        const inNode = ctx.createGain();
        let node: AudioNode = inNode;
        const eq3 = eqs[t.id] || FLAT;
        const eqNodes: BiquadFilterNode[] = [];
        ([
          ["lowshelf", 120, eq3.low],
          ["peaking", 1000, eq3.mid],
          ["highshelf", 6000, eq3.high],
        ] as const).forEach(([type, freq, gain]) => {
          const f = ctx.createBiquadFilter();
          f.type = type as BiquadFilterType;
          f.frequency.value = freq;
          f.gain.value = gain;
          if (type === "peaking") f.Q.value = 0.9;
          node.connect(f);
          node = f;
          eqNodes.push(f);
        });
        const g = ctx.createGain();
        const base = onlyStem
          ? t.id === onlyStem
            ? dbToGain(gains[t.id] ?? 0)
            : 0
          : trackGainValue(t.id);
        g.gain.value = base;
        // 音量オートメーション（点カーブ）があれば優先
        const ap = clipMode ? [] : (autos[t.id] || []).slice().sort((x, y) => x.t - y.t);
        if (ap.length >= 2) {
          const first = ap[0];
          g.gain.setValueAtTime(base * first.v, ctx.currentTime);
          for (const p of ap) {
            const at = ctx.currentTime + Math.max(0, p.t - off);
            g.gain.linearRampToValueAtTime(Math.max(0.0001, base * p.v), at);
          }
        }
        // 区間ごとの音量をオートメーションで反映（試聴）
        for (const r of (clipMode || ap.length >= 2 ? [] : regions[t.id] || [])) {
          if (r.end <= r.start || r.end <= off) continue;
          const t0 = ctx.currentTime + Math.max(0, r.start - off);
          const t1 = ctx.currentTime + (r.end - off);
          if (r.fade === "out") {
            g.gain.setValueAtTime(base, t0);
            g.gain.linearRampToValueAtTime(0.0001, t1);
            g.gain.setValueAtTime(base, t1 + 0.001);
          } else if (r.fade === "in") {
            g.gain.setValueAtTime(0.0001, t0);
            g.gain.linearRampToValueAtTime(base, t1);
          } else {
            const rg = base * dbToGain(r.gain);
            g.gain.setValueAtTime(base, t0);
            g.gain.setValueAtTime(rg, t0 + 0.001);
            g.gain.setValueAtTime(base, t1);
          }
        }
        // コンプレッサー
        if (comps[t.id]) {
          const comp = ctx.createDynamicsCompressor();
          comp.threshold.value = -18;
          comp.ratio.value = 3;
          comp.attack.value = 0.02;
          comp.release.value = 0.2;
          node.connect(comp);
          node = comp;
        }
        // リバーブ（wet/dry）
        const rv = reverbs[t.id] || 0;
        if (rv > 0) {
          if (!irRef.current) irRef.current = makeIR(ctx);
          const conv = ctx.createConvolver();
          conv.buffer = irRef.current;
          const wet = ctx.createGain();
          wet.gain.value = (rv / 100) * 0.6;
          node.connect(g); // dry
          node.connect(conv);
          conv.connect(wet);
          wet.connect(g);
        } else {
          node.connect(g);
        }
        const panner = ctx.createStereoPanner();
        panner.pan.value = pans[t.id] ?? 0;
        g.connect(panner);
        panner.connect(master);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 256;
        panner.connect(analyser); // メーター用の分岐（出力には影響しない）
        const srcs: AudioBufferSourceNode[] = [];
        if (clipMode) {
          for (const c of clips[t.id] || []) {
            if (c.mute) continue;
            const end = c.offset + c.srcDur;
            if (end <= off) continue;
            const cs = ctx.createBufferSource();
            cs.buffer = buf;
            const cg = ctx.createGain();
            const cbase = dbToGain(c.gain || 0);
            cs.connect(cg);
            cg.connect(inNode);
            let startAbs: number, srcS: number, playDur: number, freshStart: boolean;
            if (off <= c.offset) {
              startAbs = ctx.currentTime + (c.offset - off);
              srcS = c.srcStart;
              playDur = c.srcDur;
              freshStart = true;
            } else {
              const into = off - c.offset;
              startAbs = ctx.currentTime;
              srcS = c.srcStart + into;
              playDur = c.srcDur - into;
              freshStart = false;
            }
            const fi = c.fadeIn || 0;
            const fo = c.fadeOut || 0;
            if (freshStart && fi > 0) {
              cg.gain.setValueAtTime(0.0001, startAbs);
              cg.gain.linearRampToValueAtTime(cbase, startAbs + Math.min(fi, playDur));
            } else {
              cg.gain.setValueAtTime(cbase, startAbs);
            }
            if (fo > 0 && fo < playDur) {
              const endAbs = startAbs + playDur;
              cg.gain.setValueAtTime(cbase, endAbs - fo);
              cg.gain.linearRampToValueAtTime(0.0001, endAbs);
            }
            cs.start(startAbs, srcS, playDur);
            srcs.push(cs);
          }
        } else {
          const cs = ctx.createBufferSource();
          cs.buffer = buf;
          cs.connect(inNode);
          cs.start(0, off);
          srcs.push(cs);
        }
        nodesRef.current[t.id] = { srcs, gain: g, eq: eqNodes, pan: panner, analyser };
      }
      setPlaying(true);
      if (meterRafRef.current) cancelAnimationFrame(meterRafRef.current);
      meterRafRef.current = requestAnimationFrame(runMeters);
      const tick = () => {
        const t = offsetRef.current + (ctx.currentTime - startedAtRef.current);
        setCursor(Math.min(duration, t));
        if (t < duration) rafRef.current = requestAnimationFrame(tick);
        else stopPlayback();
      };
      rafRef.current = requestAnimationFrame(tick);
    },
    [buffers, eqs, comps, reverbs, pans, autos, clips, clipMode, masterVol, cursor, duration, gains, regions, trackGainValue, stopPlayback, runMeters]
  );

  // ライブ反映
  useEffect(() => {
    Object.entries(nodesRef.current).forEach(([stem, n]) => {
      n.gain.gain.value = trackGainValue(stem);
    });
  }, [gains, mutes, solos, trackGainValue]);
  useEffect(() => {
    if (masterRef.current) masterRef.current.gain.value = dbToGain(masterVol);
  }, [masterVol]);
  useEffect(() => {
    Object.entries(nodesRef.current).forEach(([stem, n]) => {
      if (n.pan) n.pan.pan.value = pans[stem] ?? 0;
    });
  }, [pans]);
  useEffect(() => {
    Object.entries(nodesRef.current).forEach(([stem, n]) => {
      const e = eqs[stem] || FLAT;
      if (n.eq[0]) n.eq[0].gain.value = e.low;
      if (n.eq[1]) n.eq[1].gain.value = e.mid;
      if (n.eq[2]) n.eq[2].gain.value = e.high;
    });
  }, [eqs]);
  useEffect(() => () => stopPlayback(), [stopPlayback]);

  // 編集状態のスナップショット（Undo用）
  const snapshot = () =>
    JSON.stringify({
      gains,
      mutes,
      solos,
      eqs,
      comps,
      reverbs,
      pans,
      regions,
      autos,
      clips,
      trimStart,
      trimEnd,
      fadeIn,
      fadeOut,
      masterVol,
    });
  const restore = (str: string) => {
    const s = JSON.parse(str);
    restoringRef.current = true;
    setGains(s.gains);
    setMutes(s.mutes);
    setSolos(s.solos);
    setEqs(s.eqs);
    setComps(s.comps);
    setReverbs(s.reverbs);
    setPans(s.pans || {});
    setRegions(s.regions);
    setAutos(s.autos || {});
    setClips(s.clips || {});
    setTrimStart(s.trimStart);
    setTrimEnd(s.trimEnd);
    setFadeIn(s.fadeIn);
    setFadeOut(s.fadeOut);
    setMasterVol(s.masterVol);
  };
  // 変更を350ms待って履歴に積む
  useEffect(() => {
    if (Object.keys(buffers).length === 0) return;
    if (restoringRef.current) {
      restoringRef.current = false;
      return;
    }
    const snap = snapshot();
    const timer = setTimeout(() => {
      const h = histRef.current;
      if (idxRef.current < 0) {
        h.push(snap);
        idxRef.current = 0;
        return;
      }
      if (h[idxRef.current] === snap) return;
      h.splice(idxRef.current + 1);
      h.push(snap);
      idxRef.current = h.length - 1;
      setCanUndo(idxRef.current > 0);
      setCanRedo(false);
    }, 350);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gains, mutes, solos, eqs, comps, reverbs, pans, regions, autos, clips, trimStart, trimEnd, fadeIn, fadeOut, masterVol, buffers]);

  const undo = useCallback(() => {
    if (idxRef.current <= 0) return;
    idxRef.current -= 1;
    restore(histRef.current[idxRef.current]);
    setCanUndo(idxRef.current > 0);
    setCanRedo(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const redo = useCallback(() => {
    if (idxRef.current >= histRef.current.length - 1) return;
    idxRef.current += 1;
    restore(histRef.current[idxRef.current]);
    setCanRedo(idxRef.current < histRef.current.length - 1);
    setCanUndo(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undo, redo]);

  const seek = (clientX: number, el: HTMLElement) => {
    const rect = el.getBoundingClientRect();
    const frac = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const t = frac * duration;
    setCursor(t);
    if (playing) play(t);
  };

  const setEq = (stem: string, band: keyof Eq3, val: number) =>
    setEqs((s) => ({ ...s, [stem]: { ...(s[stem] || FLAT), [band]: val } }));

  // 区間選択（ドラッグ）
  const fracOf = (clientX: number, el: HTMLElement) => {
    const r = el.getBoundingClientRect();
    return Math.max(0, Math.min(1, (clientX - r.left) / r.width));
  };
  const onLaneDown = (stem: string, e: React.MouseEvent<HTMLDivElement>) => {
    dragRef.current = { stem, startFrac: fracOf(e.clientX, e.currentTarget) };
  };
  const onLaneMove = (stem: string, e: React.MouseEvent<HTMLDivElement>) => {
    if (!dragRef.current || dragRef.current.stem !== stem) return;
    const cur = fracOf(e.clientX, e.currentTarget);
    const a = Math.min(dragRef.current.startFrac, cur);
    const b = Math.max(dragRef.current.startFrac, cur);
    if (b - a > 0.005) setSel({ stem, start: a * duration, end: b * duration });
  };
  const onLaneUp = (stem: string, e: React.MouseEvent<HTMLDivElement>) => {
    const d = dragRef.current;
    dragRef.current = null;
    if (!d) return;
    const cur = fracOf(e.clientX, e.currentTarget);
    if (Math.abs(cur - d.startFrac) <= 0.005) {
      // ほぼ動いていない＝シーク
      setSel(null);
      const t = cur * duration;
      setCursor(t);
      if (playing) play(t);
    }
  };
  const applyRegion = (gainDb: number, fade?: "in" | "out") => {
    if (!sel) return;
    setRegions((rs) => ({
      ...rs,
      [sel.stem]: [
        ...(rs[sel.stem] || []),
        { start: sel.start, end: sel.end, gain: gainDb, fade },
      ],
    }));
    setSelected(sel.stem);
    setSel(null);
  };
  const removeRegion = (stem: string, idx: number) =>
    setRegions((rs) => ({ ...rs, [stem]: (rs[stem] || []).filter((_, i) => i !== idx) }));

  // 区間ブロックをドラッグで時間移動
  const regionDown = (stem: string, idx: number, e: React.PointerEvent<HTMLDivElement>) => {
    e.stopPropagation();
    const lane = (e.currentTarget as HTMLElement).closest("[data-lane]") as HTMLElement;
    const r = regions[stem]?.[idx];
    if (!lane || !r) return;
    rDragRef.current = {
      stem,
      idx,
      laneW: lane.getBoundingClientRect().width,
      startX: e.clientX,
      origStart: r.start,
      origEnd: r.end,
    };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const regionMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = rDragRef.current;
    if (!d) return;
    const dt = ((e.clientX - d.startX) / d.laneW) * duration;
    const len = d.origEnd - d.origStart;
    let ns = Math.max(0, Math.min(duration - len, snapTime(d.origStart + dt)));
    setRegions((rs) => {
      const arr = [...(rs[d.stem] || [])];
      if (arr[d.idx]) arr[d.idx] = { ...arr[d.idx], start: ns, end: ns + len };
      return { ...rs, [d.stem]: arr };
    });
  };
  const regionUp = () => {
    rDragRef.current = null;
  };

  // ---- クリップ操作 ----
  const splitClips = () => {
    setClips((cs) => {
      const next: Record<string, Clip[]> = {};
      for (const t of TRACKS) {
        const arr = cs[t.id];
        if (!arr) continue;
        const out: Clip[] = [];
        for (const c of arr) {
          if (cursor > c.offset + 0.05 && cursor < c.offset + c.srcDur - 0.05) {
            const local = cursor - c.offset;
            out.push({ ...c, srcDur: local });
            out.push({
              id: `c${clipCounter.current++}`,
              srcStart: c.srcStart + local,
              srcDur: c.srcDur - local,
              offset: cursor,
              gain: c.gain,
              mute: c.mute,
            });
          } else out.push(c);
        }
        next[t.id] = out;
      }
      return next;
    });
  };
  const deleteClip = (stem: string, cid: string) => {
    setClips((cs) => ({ ...cs, [stem]: (cs[stem] || []).filter((c) => c.id !== cid) }));
    setSelClip((sc) => (sc && sc.stem === stem && sc.id === cid ? null : sc));
  };
  const toggleClipMute = (stem: string, cid: string) =>
    setClips((cs) => ({
      ...cs,
      [stem]: (cs[stem] || []).map((c) => (c.id === cid ? { ...c, mute: !c.mute } : c)),
    }));
  const clipDown = (stem: string, cid: string, e: React.PointerEvent<HTMLDivElement>) => {
    e.stopPropagation();
    setSelClip({ stem, id: cid });
    const lane = (e.currentTarget as HTMLElement).closest("[data-lane]") as HTMLElement;
    const c = (clips[stem] || []).find((x) => x.id === cid);
    if (!lane || !c) return;
    clipDragRef.current = {
      stem,
      id: cid,
      laneW: lane.getBoundingClientRect().width,
      startX: e.clientX,
      orig: c.offset,
    };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const clipMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = clipDragRef.current;
    if (!d) return;
    const dt = ((e.clientX - d.startX) / d.laneW) * duration;
    const no = Math.max(0, snapTime(d.orig + dt));
    setClips((cs) => ({
      ...cs,
      [d.stem]: (cs[d.stem] || []).map((c) => (c.id === d.id ? { ...c, offset: no } : c)),
    }));
  };
  const clipUp = () => {
    clipDragRef.current = null;
  };
  // クリップの属性を更新（ゲイン・フェード）
  const updateClip = (stem: string, cid: string, patch: Partial<Clip>) =>
    setClips((cs) => ({
      ...cs,
      [stem]: (cs[stem] || []).map((c) => (c.id === cid ? { ...c, ...patch } : c)),
    }));
  // クリップ複製（右隣に配置＝繰り返しに便利）
  const duplicateClip = (stem: string, cid: string) =>
    setClips((cs) => {
      const arr = cs[stem] || [];
      const c = arr.find((x) => x.id === cid);
      if (!c) return cs;
      return {
        ...cs,
        [stem]: [...arr, { ...c, id: `c${clipCounter.current++}`, offset: c.offset + c.srcDur }],
      };
    });
  // クリップ右端ドラッグで長さ変更（トリム）
  const rzDragRef = useRef<{
    stem: string;
    id: string;
    laneW: number;
    startX: number;
    orig: number;
    maxDur: number;
  } | null>(null);
  const clipResizeDown = (stem: string, cid: string, e: React.PointerEvent<HTMLDivElement>) => {
    e.stopPropagation();
    const lane = (e.currentTarget as HTMLElement).closest("[data-lane]") as HTMLElement;
    const c = (clips[stem] || []).find((x) => x.id === cid);
    const buf = buffers[stem];
    if (!lane || !c || !buf) return;
    rzDragRef.current = {
      stem,
      id: cid,
      laneW: lane.getBoundingClientRect().width,
      startX: e.clientX,
      orig: c.srcDur,
      maxDur: buf.duration - c.srcStart,
    };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const clipResizeMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = rzDragRef.current;
    if (!d) return;
    const dt = ((e.clientX - d.startX) / d.laneW) * duration;
    const nd = Math.max(0.1, Math.min(d.maxDur, d.orig + dt));
    setClips((cs) => ({
      ...cs,
      [d.stem]: (cs[d.stem] || []).map((c) => (c.id === d.id ? { ...c, srcDur: nd } : c)),
    }));
  };
  const clipResizeUp = () => {
    rzDragRef.current = null;
  };
  // クリップが動かされている（初期状態から変化）か
  const clipsEdited = TRACKS.some((t) => {
    const arr = clips[t.id];
    if (!arr) return false;
    if (arr.length !== 1) return true;
    const c = arr[0];
    return c.offset !== 0 || c.srcStart !== 0 || !!c.mute;
  });

  // ---- 音量オートメーション ----
  const autoTV = (stem: string, e: React.PointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const fx = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width));
    const fy = Math.max(0, Math.min(1, (e.clientY - r.top) / r.height));
    return { t: fx * duration, v: (1 - fy) * AUTO_MAX };
  };
  const nearestAutoIdx = (stem: string, t: number) => {
    const pts = autos[stem] || [];
    let best = -1;
    let bd = Infinity;
    pts.forEach((p, i) => {
      const d = Math.abs(p.t - t);
      if (d < bd) {
        bd = d;
        best = i;
      }
    });
    return bd < duration * 0.02 ? best : -1;
  };
  const autoDown = (stem: string, e: React.PointerEvent<HTMLDivElement>) => {
    e.stopPropagation();
    const { t, v } = autoTV(stem, e);
    let idx = nearestAutoIdx(stem, t);
    if (idx < 0) {
      setAutos((a) => {
        const pts = [...(a[stem] || []), { t, v }].sort((x, y) => x.t - y.t);
        idx = pts.findIndex((p) => p.t === t && p.v === v);
        autoDragRef.current = { stem, idx };
        return { ...a, [stem]: pts };
      });
    } else {
      autoDragRef.current = { stem, idx };
    }
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const autoMove = (stem: string, e: React.PointerEvent<HTMLDivElement>) => {
    const d = autoDragRef.current;
    if (!d || d.stem !== stem) return;
    const { t, v } = autoTV(stem, e);
    setAutos((a) => {
      const pts = [...(a[stem] || [])];
      if (pts[d.idx]) pts[d.idx] = { t, v };
      return { ...a, [stem]: pts };
    });
  };
  const autoUp = (stem: string) => {
    const d = autoDragRef.current;
    autoDragRef.current = null;
    if (!d) return;
    // ドラッグ後にt順へ整列
    setAutos((a) => ({ ...a, [stem]: [...(a[stem] || [])].sort((x, y) => x.t - y.t) }));
  };
  const autoRemove = (stem: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const r = (e.currentTarget as HTMLElement)
      .closest("[data-lane]")!
      .getBoundingClientRect();
    const t = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)) * duration;
    const idx = nearestAutoIdx(stem, t);
    if (idx >= 0)
      setAutos((a) => ({ ...a, [stem]: (a[stem] || []).filter((_, i) => i !== idx) }));
  };

  const doExport = async () => {
    setExporting(true);
    setError(null);
    try {
      // クリップ編集がある場合はクリップ書き出し
      if (clipMode && clipsEdited) {
        const ctracks = TRACKS.filter((t) => stemUrls[t.id]).map((t) => {
          const e = eqs[t.id] || FLAT;
          return {
            stem: t.id,
            gain: gains[t.id] ?? 0,
            eq: [
              { freq: 120, gain: e.low, q: 0.7 },
              { freq: 1000, gain: e.mid, q: 0.9 },
              { freq: 6000, gain: e.high, q: 0.7 },
            ].filter((b) => b.gain !== 0),
            comp: !!comps[t.id],
            reverb: reverbs[t.id] || 0,
            pan: pans[t.id] || 0,
            clips: (clips[t.id] || []).filter((c) => !c.mute && c.srcDur > 0),
          };
        });
        const r = await fetch("/api/music-studio/clipmix", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            jobId: id,
            stemsId,
            tracks: ctracks,
            global: { trimStart, trimEnd: trimEnd < duration ? trimEnd : 0, fadeIn, fadeOut },
          }),
        });
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || "書き出し失敗");
        setMixUrl(d.remixUrl);
        setExporting(false);
        return;
      }
      const tracks = TRACKS.filter((t) => stemUrls[t.id]).map((t) => {
        const e = eqs[t.id] || FLAT;
        return {
          stem: t.id,
          gain: gains[t.id] ?? 0,
          mute: mutes[t.id] || (anySolo && !solos[t.id]),
          eq: [
            { freq: 120, gain: e.low, q: 0.7 },
            { freq: 1000, gain: e.mid, q: 0.9 },
            { freq: 6000, gain: e.high, q: 0.7 },
          ].filter((b) => b.gain !== 0),
          regions: regions[t.id] || [],
          comp: !!comps[t.id],
          reverb: reverbs[t.id] || 0,
          pan: pans[t.id] || 0,
          auto: autos[t.id] || [],
        };
      });
      const r = await fetch("/api/music-studio/mixdown", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jobId: id,
          stemsId,
          tracks,
          global: {
            trimStart,
            trimEnd: trimEnd < duration ? trimEnd : 0,
            fadeIn,
            fadeOut,
          },
        }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "書き出し失敗");
      setMixUrl(d.remixUrl);
    } catch (e) {
      setError(String(e));
    } finally {
      setExporting(false);
    }
  };

  const playPct = duration ? (cursor / duration) * 100 : 0;
  const HEADER_W = 208; // px
  const laneW = Math.max(300, duration * pxPerSec); // タイムライン幅(px)
  // 定規の目盛り間隔（ズームに応じて秒/5秒/10秒）
  const tickStep = pxPerSec >= 80 ? 1 : pxPerSec >= 30 ? 5 : 10;
  const ticks: number[] = [];
  for (let s = 0; s <= duration; s += tickStep) ticks.push(s);
  // 小節/拍グリッド（4/4想定）
  const secPerBeat = 60 / Math.max(30, Math.min(300, bpm));
  const secPerBar = secPerBeat * 4;
  const bars: number[] = [];
  for (let t = 0; t <= duration + secPerBar; t += secPerBar) bars.push(t);
  const beats: number[] = [];
  for (let t = 0; t <= duration + secPerBeat; t += secPerBeat) beats.push(t);
  const snapTime = (t: number) => (snap ? Math.round(t / secPerBeat) * secPerBeat : t);

  const hasStems = Object.keys(stemUrls).length > 0;
  const decoded = Object.keys(buffers).length > 0;
  const selTrack = TRACKS.find((t) => t.id === selected)!;
  const selEq = eqs[selected] || FLAT;

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-[var(--bg)] text-[var(--text)]">
      <header className="sticky top-0 z-10 border-b border-[var(--border)] bg-[var(--bg)]/95 backdrop-blur px-5 py-3 flex items-center gap-3">
        <button
          onClick={() => router.push("/music-studio")}
          className="flex items-center gap-1 text-sm text-[var(--text-dim)] hover:text-[var(--text)]"
        >
          <Chevron className="rotate-90" size={16} /> スタジオ
        </button>
        <div className="w-px h-5 bg-[var(--border)]" />
        <Sliders size={18} className="text-[var(--accent)]" />
        <h1 className="text-sm font-semibold truncate">{title || "編集"}</h1>
        <span className="text-xs text-[var(--text-dim)] font-mono">マルチトラック編集</span>
        <div className="flex items-center gap-1 ml-3">
          <button
            onClick={undo}
            disabled={!canUndo}
            title="元に戻す (Ctrl+Z)"
            className="px-2 py-1 rounded text-xs bg-zinc-800 text-zinc-300 hover:bg-zinc-700 disabled:opacity-30"
          >
            ↶ 戻す
          </button>
          <button
            onClick={redo}
            disabled={!canRedo}
            title="やり直す (Ctrl+Shift+Z)"
            className="px-2 py-1 rounded text-xs bg-zinc-800 text-zinc-300 hover:bg-zinc-700 disabled:opacity-30"
          >
            ↷ やり直し
          </button>
        </div>
        <Link
          href="/help"
          className="ml-auto text-xs text-[var(--text-dim)] hover:text-[var(--accent-2)] inline-flex items-center gap-1"
        >
          <HelpBadge /> ヘルプ・用語
        </Link>
      </header>

      {loading ? (
        <div className="h-[60vh] flex items-center justify-center text-[var(--text-dim)]">
          読み込み中…
        </div>
      ) : !hasStems ? (
        // 分解前
        <div className="max-w-lg mx-auto mt-24 text-center px-6">
          <Layers size={40} className="mx-auto text-[var(--accent)] mb-4" />
          <h2 className="text-lg font-semibold mb-2">楽器ごとに分解して編集</h2>
          <p className="text-sm text-[var(--text-dim)] mb-5 leading-relaxed">
            この曲を「ボーカル / ドラム / ベース / ギター / ピアノ / その他」の6トラックに分解します。
            分解後、各パートを個別に音量・EQ調整してミックスできます（DAWのような編集）。
            <br />
            分解はCPUで数十秒〜数分かかります。
          </p>
          <button
            onClick={runSeparate}
            disabled={separating}
            className="px-5 py-2.5 rounded-lg bg-[var(--accent)] text-black font-semibold disabled:opacity-50"
          >
            {separating ? "分解中…（お待ちください）" : "楽器ごとに分解する"}
          </button>
          {error && <p className="text-red-400 text-sm mt-4">{error}</p>}
        </div>
      ) : !decoded ? (
        <div className="h-[60vh] flex items-center justify-center text-[var(--text-dim)]">
          トラックを読み込み中…
        </div>
      ) : (
        <div className="flex-1 flex flex-col min-h-0 px-3 py-2 gap-2 overflow-hidden">
          {/* トランスポート */}
          <div className="flex-none flex items-center gap-3 flex-wrap">
            <button
              onClick={() => (playing ? stopPlayback() : play())}
              className="w-10 h-10 rounded-full bg-[var(--accent)] text-black flex items-center justify-center hover:opacity-90"
            >
              {playing ? <Pause size={18} /> : <Play size={18} />}
            </button>
            <span className="text-sm font-mono text-[var(--text-dim)]">
              {fmt(cursor)} / {fmt(duration)}
            </span>
            <Tip text="クリップ編集：波形を「分割」でブロックに切り、ドラッグで移動・×で削除・Mでミュート。DAWのような並べ替えができます。" below>
              <button
                onClick={() => {
                  setClipMode((v) => !v);
                  setAutoMode(false);
                  setSel(null);
                }}
                className={`ml-3 px-3 py-1.5 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 ${
                  clipMode
                    ? "bg-[var(--accent)] text-black"
                    : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
                }`}
              >
                <Layers size={13} /> クリップ編集{clipMode ? "：ON" : ""}
              </button>
            </Tip>
            {clipMode && (
              <button
                onClick={splitClips}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-sky-600 text-white hover:bg-sky-500 inline-flex items-center gap-1"
                title="再生位置で全トラックを分割"
              >
                ✂ 分割
              </button>
            )}
            <Tip text="音量オートメーション：波形をクリックで点を追加、ドラッグで上下＝音量カーブ。ダブルクリックで点を削除。Bメロで下げてサビで戻す等の演出に。" below>
              <button
                onClick={() => {
                  setAutoMode((v) => !v);
                  setClipMode(false);
                  setSel(null);
                }}
                className={`ml-1 px-3 py-1.5 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 ${
                  autoMode
                    ? "bg-[var(--accent)] text-black"
                    : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
                }`}
              >
                <Sliders size={13} /> オートメーション{autoMode ? "：ON" : ""}
              </button>
            </Tip>
            <button
              onClick={() => setShowMixer((v) => !v)}
              className={`ml-1 px-3 py-1.5 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 ${
                showMixer ? "bg-[var(--accent)] text-black" : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
              }`}
              title="ミキサー（コンソール）表示"
            >
              🎚 ミキサー
            </button>
            <div className="ml-auto flex items-center gap-2 text-xs text-[var(--text-dim)]">
              マスター音量
              <input
                type="range"
                min={-24}
                max={6}
                step={1}
                value={masterVol}
                onChange={(e) => setMasterVol(Number(e.target.value))}
                className="w-28"
              />
              <span className="font-mono w-10 text-right">
                {masterVol > 0 ? "+" : ""}
                {masterVol}dB
              </span>
            </div>
          </div>

          {/* マルチトラック（DAWアレンジビュー） */}
          <div className="rounded-xl border border-[var(--border)] overflow-hidden bg-[#0f0f11] flex-1 min-h-0 flex flex-col">
            <div className="flex-none flex items-center gap-2 px-2 py-1 border-b border-[var(--border)] bg-[var(--surface)] text-xs">
              <span className="text-[var(--text-dim)]">BPM</span>
              <input type="number" min={40} max={240} value={bpm} onChange={(e) => setBpm(Number(e.target.value) || 120)} className="w-14 rounded bg-zinc-900 border border-zinc-800 px-1.5 py-0.5 text-xs" />
              <label className="flex items-center gap-1 text-[var(--text-dim)] cursor-pointer">
                <input type="checkbox" checked={snap} onChange={(e) => setSnap(e.target.checked)} className="accent-orange" />
                スナップ
              </label>
              <span className="text-[10px] text-[var(--text-dim)] ml-2">画面幅にフィット（スクロールなし）</span>
            </div>
            <div className="flex-1 min-h-0 flex flex-col">
              <div className="relative flex-1 min-h-0 flex flex-col">
                {/* 定規 */}
                <div className="flex-none flex border-b border-[var(--border)] bg-[var(--surface)]" style={{ height: 22 }}>
                  <div className="flex-none border-r border-[var(--border)]" style={{ width: HEADER_W }} />
                  <div className="relative flex-1 cursor-pointer" onClick={(e) => seek(e.clientX, e.currentTarget)}>
                    {bars.map((t, i) => (
                      <div key={i} className="absolute top-0 bottom-0 border-l border-[var(--border)]" style={{ left: `${(t / duration) * 100}%` }}>
                        <span className="absolute top-0 left-0.5 text-[9px] text-[var(--text-dim)] font-mono">{i + 1}</span>
                      </div>
                    ))}
                  </div>
                </div>
                {/* トラック群 */}
                <div className="flex-1 min-h-0 flex flex-col">
            {availableStems.map((t) => {
              const muted = mutes[t.id] || (anySolo && !solos[t.id]);
              return (
                <div
                  key={t.id}
                  className={`flex-1 min-h-0 flex border-b border-[var(--border)] last:border-b-0 ${
                    selected === t.id ? "bg-white/[0.02]" : ""
                  }`}
                >
                  {/* トラックヘッダー */}
                  <div
                    className="flex-none border-r border-[var(--border)] bg-[#141416] p-2 flex flex-col gap-1.5 cursor-pointer overflow-hidden"
                    style={{ width: HEADER_W }}
                    onClick={() => setSelected(t.id)}
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className="w-2.5 h-2.5 rounded-sm flex-none"
                        style={{ background: t.color }}
                      />
                      <span className="text-sm font-medium">{t.label}</span>
                      <div className="ml-auto flex gap-1">
                        <Tip text={`${t.label}だけを再生します`} below>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              play(cursor, t.id);
                            }}
                            className="w-6 h-6 rounded bg-zinc-800 text-zinc-300 hover:bg-zinc-700 flex items-center justify-center"
                          >
                            <Play size={11} />
                          </button>
                        </Tip>
                        <Tip text="ソロ：このパートだけを鳴らします" below>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSolos((s) => ({ ...s, [t.id]: !s[t.id] }));
                            }}
                            className={`w-6 h-6 rounded text-[10px] font-bold ${
                              solos[t.id]
                                ? "bg-[var(--accent)] text-black"
                                : "bg-zinc-800 text-zinc-400"
                            }`}
                          >
                            S
                          </button>
                        </Tip>
                        <Tip text="ミュート：このパートを消します" below>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setMutes((m) => ({ ...m, [t.id]: !m[t.id] }));
                            }}
                            className={`w-6 h-6 rounded text-[10px] font-bold ${
                              mutes[t.id] ? "bg-red-500 text-white" : "bg-zinc-800 text-zinc-400"
                            }`}
                          >
                            M
                          </button>
                        </Tip>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="range"
                        min={-30}
                        max={6}
                        step={1}
                        value={gains[t.id] ?? 0}
                        onChange={(e) =>
                          setGains((g) => ({ ...g, [t.id]: Number(e.target.value) }))
                        }
                        onClick={(e) => e.stopPropagation()}
                        className="flex-1"
                      />
                      <span className="text-[10px] font-mono text-[var(--text-dim)] w-9 text-right">
                        {(gains[t.id] ?? 0) > 0 ? "+" : ""}
                        {gains[t.id] ?? 0}
                      </span>
                    </div>
                  </div>
                  {/* 波形レーン（ドラッグで範囲選択 / オートメーション） */}
                  <div
                    data-lane
                    className={`flex-1 relative select-none ${muted ? "opacity-30" : ""} ${
                      autoMode ? "cursor-crosshair" : "cursor-text"
                    }`}
                    onMouseDown={(e) => !autoMode && !clipMode && onLaneDown(t.id, e)}
                    onMouseMove={(e) => !autoMode && !clipMode && onLaneMove(t.id, e)}
                    onMouseUp={(e) => !autoMode && !clipMode && onLaneUp(t.id, e)}
                  >
                    <canvas
                      ref={(el) => {
                        canvasRefs.current[t.id] = el;
                      }}
                      width={2400}
                      height={96}
                      className={`w-full h-full block pointer-events-none ${clipMode ? "opacity-25" : ""}`}
                    />
                    {/* グリッド */}
                    <div className="absolute inset-0 pointer-events-none">
                      {beats.map((t, i) => (
                        <div key={i} className="absolute top-0 bottom-0 border-l border-white/[0.05]" style={{ left: `${(t / duration) * 100}%` }} />
                      ))}
                      {bars.map((t, i) => (
                        <div key={`b${i}`} className="absolute top-0 bottom-0 border-l border-white/[0.14]" style={{ left: `${(t / duration) * 100}%` }} />
                      ))}
                    </div>
                    {/* 確定した区間（ドラッグで移動・×で削除） */}
                    {!clipMode && (regions[t.id] || []).map((r, ri) => (
                      <div
                        key={ri}
                        onPointerDown={(e) => regionDown(t.id, ri, e)}
                        onPointerMove={regionMove}
                        onPointerUp={regionUp}
                        title="ドラッグで移動 / ×で削除"
                        className="group absolute top-0 bottom-0 border-x border-sky-400/70 bg-sky-400/20 cursor-grab active:cursor-grabbing hover:bg-sky-400/30"
                        style={{
                          left: `${(r.start / duration) * 100}%`,
                          width: `${((r.end - r.start) / duration) * 100}%`,
                        }}
                      >
                        <span className="absolute top-0 left-0.5 text-[9px] text-sky-200 font-mono pointer-events-none">
                          {r.fade === "in"
                            ? "◢ IN"
                            : r.fade === "out"
                            ? "◣ OUT"
                            : r.gain <= -40
                            ? "MUTE"
                            : `${r.gain}dB`}
                        </span>
                        <button
                          onPointerDown={(e) => e.stopPropagation()}
                          onClick={(e) => {
                            e.stopPropagation();
                            removeRegion(t.id, ri);
                          }}
                          className="absolute top-0.5 right-0.5 w-3.5 h-3.5 rounded-sm bg-black/50 text-white/80 text-[9px] leading-none opacity-0 group-hover:opacity-100 flex items-center justify-center"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                    {/* ドラッグ中の選択 */}
                    {!clipMode && sel && sel.stem === t.id && (
                      <div
                        className="absolute top-0 bottom-0 bg-[var(--accent)]/25 border-x border-[var(--accent)] pointer-events-none"
                        style={{
                          left: `${(sel.start / duration) * 100}%`,
                          width: `${((sel.end - sel.start) / duration) * 100}%`,
                        }}
                      />
                    )}
                    {/* オートメーション・レーン */}
                    {autoMode && (
                      <div
                        className="absolute inset-0"
                        onPointerDown={(e) => autoDown(t.id, e)}
                        onPointerMove={(e) => autoMove(t.id, e)}
                        onPointerUp={() => autoUp(t.id)}
                        onDoubleClick={(e) => autoRemove(t.id, e)}
                      >
                        <svg
                          className="absolute inset-0 w-full h-full pointer-events-none"
                          viewBox="0 0 100 100"
                          preserveAspectRatio="none"
                        >
                          {/* 基準線(0dB) */}
                          <line
                            x1="0"
                            y1={(1 - 1 / AUTO_MAX) * 100}
                            x2="100"
                            y2={(1 - 1 / AUTO_MAX) * 100}
                            stroke="rgba(255,255,255,0.15)"
                            strokeWidth="0.4"
                          />
                          {(autos[t.id] || []).length >= 2 && (
                            <polyline
                              points={(autos[t.id] || [])
                                .map(
                                  (p) =>
                                    `${(p.t / duration) * 100},${(1 - p.v / AUTO_MAX) * 100}`
                                )
                                .join(" ")}
                              fill="none"
                              stroke={t.color}
                              strokeWidth="0.8"
                              vectorEffect="non-scaling-stroke"
                            />
                          )}
                        </svg>
                        {(autos[t.id] || []).map((p, pi) => (
                          <span
                            key={pi}
                            className="absolute w-2.5 h-2.5 rounded-full border border-white/70 -translate-x-1/2 -translate-y-1/2"
                            style={{
                              left: `${(p.t / duration) * 100}%`,
                              top: `${(1 - p.v / AUTO_MAX) * 100}%`,
                              background: t.color,
                            }}
                          />
                        ))}
                      </div>
                    )}
                    {/* クリップ・ブロック層 */}
                    {clipMode && (
                      <div className="absolute inset-0">
                        {(clips[t.id] || []).map((c) => {
                          const sr = buffers[t.id]?.sampleRate || 44100;
                          const mono = monoRef.current[t.id];
                          return (
                            <div
                              key={c.id}
                              onPointerDown={(e) => clipDown(t.id, c.id, e)}
                              onPointerMove={clipMove}
                              onPointerUp={clipUp}
                              title="ドラッグで移動 / クリックで選択（音量・フェード） / M:ミュート / ×:削除"
                              className={`group absolute top-1 bottom-1 rounded-md overflow-hidden border cursor-grab active:cursor-grabbing ${
                                c.mute ? "opacity-40" : ""
                              } ${
                                selClip?.stem === t.id && selClip?.id === c.id
                                  ? "ring-2 ring-white ring-offset-1 ring-offset-black z-[5]"
                                  : ""
                              }`}
                              style={{
                                left: `${(c.offset / duration) * 100}%`,
                                width: `${(c.srcDur / duration) * 100}%`,
                                borderColor: t.color,
                                background: t.color + "22",
                              }}
                            >
                              {/* クリップ名バー */}
                              <div
                                className="absolute top-0 left-0 right-0 h-3.5 flex items-center px-1 z-10 pointer-events-none"
                                style={{ background: t.color }}
                              >
                                <span className="text-[8px] font-bold text-black/80 truncate leading-none">
                                  {t.label}
                                </span>
                              </div>
                              {/* フェード表示 */}
                              {(c.fadeIn || c.fadeOut) && c.srcDur > 0 ? (
                                <div className="absolute inset-0 top-3.5 z-[6] pointer-events-none">
                                  {c.fadeIn ? (
                                    <div
                                      className="absolute top-0 bottom-0 left-0 bg-gradient-to-r from-black/55 to-transparent"
                                      style={{ width: `${Math.min(100, (c.fadeIn / c.srcDur) * 100)}%` }}
                                    />
                                  ) : null}
                                  {c.fadeOut ? (
                                    <div
                                      className="absolute top-0 bottom-0 right-0 bg-gradient-to-l from-black/55 to-transparent"
                                      style={{ width: `${Math.min(100, (c.fadeOut / c.srcDur) * 100)}%` }}
                                    />
                                  ) : null}
                                </div>
                              ) : null}
                              <canvas
                                width={800}
                                height={80}
                                className="w-full h-full block pointer-events-none"
                                ref={(el) => {
                                  if (el && mono) {
                                    const a = Math.floor(c.srcStart * sr);
                                    const b = Math.floor((c.srcStart + c.srcDur) * sr);
                                    drawWaveform(el, mono.subarray(a, b), t.color, "transparent");
                                  }
                                }}
                              />
                              <button
                                onPointerDown={(e) => e.stopPropagation()}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleClipMute(t.id, c.id);
                                }}
                                className="absolute top-0.5 left-0.5 w-4 h-4 rounded-sm bg-black/50 text-white/80 text-[9px] leading-none opacity-0 group-hover:opacity-100 flex items-center justify-center"
                              >
                                M
                              </button>
                              <button
                                onPointerDown={(e) => e.stopPropagation()}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  deleteClip(t.id, c.id);
                                }}
                                className="absolute top-0.5 right-0.5 w-4 h-4 rounded-sm bg-black/50 text-white/80 text-[10px] leading-none opacity-0 group-hover:opacity-100 flex items-center justify-center"
                              >
                                ×
                              </button>
                              <button
                                onPointerDown={(e) => e.stopPropagation()}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  duplicateClip(t.id, c.id);
                                }}
                                title="複製（右隣に置く＝繰り返し）"
                                className="absolute top-0.5 right-5 w-4 h-4 rounded-sm bg-black/50 text-white/80 text-[9px] leading-none opacity-0 group-hover:opacity-100 flex items-center justify-center"
                              >
                                ⧉
                              </button>
                              {/* 右端リサイズハンドル */}
                              <div
                                onPointerDown={(e) => clipResizeDown(t.id, c.id, e)}
                                onPointerMove={clipResizeMove}
                                onPointerUp={clipResizeUp}
                                title="長さを変える"
                                className="absolute top-0 bottom-0 right-0 w-2 cursor-ew-resize bg-white/0 hover:bg-white/30"
                              />
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
                </div>
                {/* 再生ヘッド */}
                <div
                  className="absolute top-0 bottom-0 w-px bg-white pointer-events-none z-10"
                  style={{ left: `calc(${HEADER_W}px + (100% - ${HEADER_W}px) * ${duration ? cursor / duration : 0})` }}
                />
              </div>
            </div>
          </div>

          {/* ミキサー（コンソール） */}
          {showMixer && (
            <div className="flex-none mt-1 rounded-xl border border-[var(--border)] bg-[#0f0f11] p-2">
              <div className="flex items-end gap-2 overflow-x-auto pb-1">
                {availableStems.map((t) => {
                  const muted = mutes[t.id] || (anySolo && !solos[t.id]);
                  return (
                    <div
                      key={t.id}
                      className={`flex-none w-16 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-1.5 flex flex-col items-center gap-1 ${
                        selected === t.id ? "ring-1 ring-[var(--accent)]" : ""
                      }`}
                      onClick={() => setSelected(t.id)}
                    >
                      <span className="w-full h-1 rounded-sm" style={{ background: t.color }} />
                      <span className="text-[10px] truncate w-full text-center">{t.label}</span>
                      <span className="text-[9px] font-mono text-[var(--text-dim)]">
                        {(gains[t.id] ?? 0) > 0 ? "+" : ""}
                        {gains[t.id] ?? 0}dB
                      </span>
                      <div className="flex items-stretch gap-1 h-28">
                        <input
                          type="range"
                          min={-40}
                          max={6}
                          step={1}
                          value={gains[t.id] ?? 0}
                          onChange={(e) =>
                            setGains((g) => ({ ...g, [t.id]: Number(e.target.value) }))
                          }
                          className="[writing-mode:vertical-lr] [direction:rtl] h-28"
                          style={{ accentColor: t.color }}
                        />
                        {/* レベルメーター */}
                        <div className="w-1.5 rounded-sm bg-black/50 overflow-hidden flex flex-col justify-end">
                          <span
                            ref={(el) => {
                              meterRefs.current[t.id] = el;
                            }}
                            className="w-full bg-gradient-to-t from-emerald-500 via-emerald-400 to-amber-300"
                            style={{ height: "0%" }}
                          />
                        </div>
                      </div>
                      {/* パン（左右定位） */}
                      <span className="text-[8px] font-mono text-[var(--text-dim)] leading-none">
                        {(() => { const p = pans[t.id] ?? 0; if (Math.abs(p) < 0.02) return "C"; return `${p < 0 ? "L" : "R"}${Math.round(Math.abs(p) * 100)}`; })()}
                      </span>
                      <input
                        type="range"
                        min={-1}
                        max={1}
                        step={0.05}
                        value={pans[t.id] ?? 0}
                        onChange={(e) =>
                          setPans((p) => ({ ...p, [t.id]: Number(e.target.value) }))
                        }
                        onDoubleClick={() => setPans((p) => ({ ...p, [t.id]: 0 }))}
                        title="左右の定位（ダブルクリックで中央）"
                        className="w-full"
                        style={{ accentColor: t.color }}
                      />
                      <div className="flex gap-0.5">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSolos((s) => ({ ...s, [t.id]: !s[t.id] }));
                          }}
                          className={`w-5 h-5 rounded text-[9px] font-bold ${
                            solos[t.id] ? "bg-[var(--accent)] text-black" : "bg-zinc-800 text-zinc-400"
                          }`}
                        >
                          S
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setMutes((m) => ({ ...m, [t.id]: !m[t.id] }));
                          }}
                          className={`w-5 h-5 rounded text-[9px] font-bold ${
                            mutes[t.id] ? "bg-red-500 text-white" : "bg-zinc-800 text-zinc-400"
                          }`}
                        >
                          M
                        </button>
                      </div>
                      <span className={`text-[8px] ${muted ? "text-red-400" : "text-emerald-400"}`}>
                        {muted ? "OFF" : "ON"}
                      </span>
                    </div>
                  );
                })}
                {/* マスター */}
                <div className="flex-none w-16 rounded-lg border border-[var(--accent)]/40 bg-[var(--accent-soft)] p-1.5 flex flex-col items-center gap-1">
                  <span className="w-full h-1 rounded-sm bg-[var(--accent)]" />
                  <span className="text-[10px] font-bold w-full text-center">MASTER</span>
                  <span className="text-[9px] font-mono text-[var(--text-dim)]">
                    {masterVol > 0 ? "+" : ""}
                    {masterVol}dB
                  </span>
                  <input
                    type="range"
                    min={-24}
                    max={6}
                    step={1}
                    value={masterVol}
                    onChange={(e) => setMasterVol(Number(e.target.value))}
                    className="[writing-mode:vertical-lr] [direction:rtl] h-28"
                    style={{ accentColor: "var(--accent)" }}
                  />
                  <div className="h-5" />
                </div>
              </div>
            </div>
          )}

          {/* クリップ・インスペクタ（クリップ毎のゲイン／フェード） */}
          {clipMode && selClip && (() => {
            const sc = (clips[selClip.stem] || []).find((c) => c.id === selClip.id);
            if (!sc) return null;
            const label = TRACKS.find((t) => t.id === selClip.stem)?.label;
            const maxFade = Math.max(0.5, sc.srcDur);
            return (
              <div className="flex-none mt-2 flex items-center gap-3 flex-wrap rounded-lg border border-[var(--accent)]/40 bg-[var(--accent-soft)] px-3 py-2 text-xs">
                <span className="text-[var(--accent-2)] font-medium whitespace-nowrap">
                  🎬 {label} クリップ（{fmt(sc.offset)}〜{fmt(sc.offset + sc.srcDur)}）
                </span>
                <label className="flex items-center gap-1.5">
                  <span className="text-[var(--text-dim)]">音量</span>
                  <input
                    type="range"
                    min={-24}
                    max={12}
                    step={1}
                    value={sc.gain || 0}
                    onChange={(e) => updateClip(selClip.stem, selClip.id, { gain: Number(e.target.value) })}
                    className="w-28"
                    style={{ accentColor: "var(--accent)" }}
                  />
                  <span className="font-mono w-11 text-right">
                    {(sc.gain || 0) > 0 ? "+" : ""}
                    {sc.gain || 0}dB
                  </span>
                </label>
                <label className="flex items-center gap-1.5">
                  <span className="text-[var(--text-dim)]">フェードイン</span>
                  <input
                    type="range"
                    min={0}
                    max={maxFade}
                    step={0.1}
                    value={sc.fadeIn || 0}
                    onChange={(e) => updateClip(selClip.stem, selClip.id, { fadeIn: Number(e.target.value) })}
                    className="w-24"
                    style={{ accentColor: "var(--accent)" }}
                  />
                  <span className="font-mono w-9 text-right">{(sc.fadeIn || 0).toFixed(1)}s</span>
                </label>
                <label className="flex items-center gap-1.5">
                  <span className="text-[var(--text-dim)]">フェードアウト</span>
                  <input
                    type="range"
                    min={0}
                    max={maxFade}
                    step={0.1}
                    value={sc.fadeOut || 0}
                    onChange={(e) => updateClip(selClip.stem, selClip.id, { fadeOut: Number(e.target.value) })}
                    className="w-24"
                    style={{ accentColor: "var(--accent)" }}
                  />
                  <span className="font-mono w-9 text-right">{(sc.fadeOut || 0).toFixed(1)}s</span>
                </label>
                <button
                  onClick={() => duplicateClip(selClip.stem, selClip.id)}
                  className="px-2.5 py-1 rounded bg-zinc-800 text-zinc-200 hover:bg-zinc-700"
                >
                  複製
                </button>
                <button
                  onClick={() => {
                    deleteClip(selClip.stem, selClip.id);
                    setSelClip(null);
                  }}
                  className="px-2.5 py-1 rounded bg-red-500/80 text-white hover:bg-red-500"
                >
                  削除
                </button>
                <button
                  onClick={() => setSelClip(null)}
                  className="ml-auto px-2 py-1 rounded bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
                >
                  閉じる
                </button>
              </div>
            );
          })()}

          {/* 区間選択の操作バー */}
          {sel ? (
            <div className="mt-2 flex items-center gap-2 rounded-lg border border-[var(--accent)]/40 bg-[var(--accent-soft)] px-3 py-2">
              <span className="text-xs text-[var(--accent-2)]">
                {TRACKS.find((t) => t.id === sel.stem)?.label} の {fmt(sel.start)}〜{fmt(sel.end)} を：
              </span>
              <button
                onClick={() => applyRegion(-6)}
                className="text-xs px-2.5 py-1 rounded bg-zinc-800 text-zinc-200 hover:bg-zinc-700"
              >
                −6dB 絞る
              </button>
              <button
                onClick={() => applyRegion(-12)}
                className="text-xs px-2.5 py-1 rounded bg-zinc-800 text-zinc-200 hover:bg-zinc-700"
              >
                −12dB 絞る
              </button>
              <button
                onClick={() => applyRegion(-60)}
                className="text-xs px-2.5 py-1 rounded bg-zinc-800 text-zinc-200 hover:bg-zinc-700"
              >
                ミュート
              </button>
              <button
                onClick={() => applyRegion(0, "in")}
                className="text-xs px-2.5 py-1 rounded bg-zinc-800 text-sky-200 hover:bg-zinc-700"
              >
                フェードイン
              </button>
              <button
                onClick={() => applyRegion(0, "out")}
                className="text-xs px-2.5 py-1 rounded bg-zinc-800 text-sky-200 hover:bg-zinc-700"
              >
                フェードアウト
              </button>
              <button
                onClick={() => setSel(null)}
                className="ml-auto text-xs text-zinc-400 hover:text-zinc-200 inline-flex items-center gap-1"
              >
                <X size={12} /> 選択解除
              </button>
            </div>
          ) : (
            <p className="mt-2 text-[11px] text-[var(--text-dim)]">
              ヒント：波形を<strong className="text-zinc-300">ドラッグ</strong>すると範囲を選べます（例：ボーカルの一部だけ絞る）。確定した区間はクリックで解除。
            </p>
          )}

          <div className="flex-none grid md:grid-cols-2 gap-3 max-h-[34vh] overflow-y-auto">
            {/* 選択トラックのEQ */}
            <section className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-dim)] mb-3 flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-sm" style={{ background: selTrack.color }} />
                {selTrack.label} のEQ（音の高さ別に増減）
              </h2>
              <div className="grid grid-cols-3 gap-4">
                {([
                  ["low", "低音", "100Hz付近"],
                  ["mid", "中音", "1kHz付近"],
                  ["high", "高音", "6kHz付近"],
                ] as const).map(([band, label, hint]) => (
                  <div key={band} className="text-center">
                    <div className="text-xs font-medium mb-1">{label}</div>
                    <input
                      type="range"
                      min={-12}
                      max={12}
                      step={1}
                      value={selEq[band]}
                      onChange={(e) => setEq(selected, band, Number(e.target.value))}
                      className="w-full"
                    />
                    <div className="text-[11px] font-mono text-[var(--accent-2)]">
                      {selEq[band] > 0 ? "+" : ""}
                      {selEq[band]}dB
                    </div>
                    <div className="text-[9px] text-[var(--text-dim)]">{hint}</div>
                  </div>
                ))}
              </div>

              {/* パート別エフェクト（コンプ・リバーブ） */}
              <div className="mt-4 pt-3 border-t border-[var(--border)] flex items-center gap-4">
                <Tip text="コンプレッサー：音の粒をそろえて、前に出して安定させます（ボーカルやドラムに有効）。">
                  <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                    <input
                      type="checkbox"
                      checked={!!comps[selected]}
                      onChange={(e) =>
                        setComps((c) => ({ ...c, [selected]: e.target.checked }))
                      }
                      className="accent-orange"
                    />
                    コンプ <HelpBadge />
                  </label>
                </Tip>
                <div className="flex-1 flex items-center gap-2">
                  <Tip text="リバーブ：残響（お風呂のような響き）を足して空間や広がりを出します。">
                    <span className="text-xs text-[var(--text-dim)] inline-flex items-center gap-1">
                      リバーブ <HelpBadge />
                    </span>
                  </Tip>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    step={5}
                    value={reverbs[selected] || 0}
                    onChange={(e) =>
                      setReverbs((r) => ({ ...r, [selected]: Number(e.target.value) }))
                    }
                    className="flex-1"
                  />
                  <span className="text-[11px] font-mono text-[var(--text-dim)] w-8 text-right">
                    {reverbs[selected] || 0}
                  </span>
                </div>
              </div>

              <p className="text-[10px] text-[var(--text-dim)] mt-3">
                トラックのヘッダーをクリックで選択。再生しながら動かすと、そのパートだけ音がその場で変わります。
              </p>
            </section>

            {/* 全体 & 書き出し */}
            <section className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-dim)] mb-3">
                全体：トリム・フェード・書き出し
              </h2>
              <div className="grid grid-cols-2 gap-3 mb-3">
                {([
                  ["フェードイン(秒)", fadeIn, setFadeIn, "曲の冒頭で音量をだんだん上げる秒数。3なら最初の3秒で音が立ち上がります。"],
                  ["フェードアウト(秒)", fadeOut, setFadeOut, "曲の終わりで音量をだんだん下げる秒数。3なら最後の3秒でスーッと消えます。"],
                  ["開始トリム(秒)", trimStart, setTrimStart, "トリム=前後を切り取ること。頭の無音や不要部分を秒数ぶん削ります。"],
                  ["終了トリム(秒)", trimEnd, setTrimEnd, "曲を短くする終了位置。ここより後ろを切り落とします。"],
                ] as const).map(([label, val, setter, hint], i) => (
                  <label key={i} className="text-xs">
                    <Tip text={hint}>
                      <span className="text-[var(--text-dim)] inline-flex items-center gap-1">
                        {label} <HelpBadge />
                      </span>
                    </Tip>
                    <input
                      type="number"
                      min={0}
                      max={i >= 2 ? duration : 30}
                      step={i >= 2 ? 0.1 : 0.5}
                      value={typeof val === "number" ? Number(val.toFixed(1)) : val}
                      onChange={(e) => setter(Number(e.target.value))}
                      className="w-full mt-1 rounded bg-[var(--surface-2)] border border-[var(--border)] px-2 py-1.5"
                    />
                  </label>
                ))}
              </div>
              <button
                onClick={doExport}
                disabled={exporting}
                className="w-full py-2.5 rounded-lg bg-[var(--accent)] text-black font-semibold text-sm disabled:opacity-50 hover:opacity-90 flex items-center justify-center gap-2"
              >
                <Download size={16} />
                {exporting ? "ミックス書き出し中…" : "ミックスを書き出し（48kHz/24bit WAV）"}
              </button>
              {error && decoded && <p className="text-[11px] text-red-400 mt-2">{error}</p>}
              {mixUrl && (
                <div className="mt-3 rounded-lg bg-[var(--accent-soft)] border border-[var(--accent)]/30 p-2">
                  <p className="text-[11px] text-[var(--accent-2)] mb-1">書き出し完了</p>
                  <audio controls src={mixUrl} className="w-full h-9" />
                  <a
                    href={mixUrl}
                    download
                    className="inline-flex items-center gap-1 text-xs text-[var(--accent-2)] mt-1.5 hover:underline"
                  >
                    <Download size={13} /> WAVをダウンロード
                  </a>
                </div>
              )}
            </section>
          </div>
        </div>
      )}
    </div>
  );
}
