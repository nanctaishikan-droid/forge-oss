"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  Logo,
  Wave,
  Note,
  Mic,
  Voice,
  Sliders,
  Spark,
  Download,
  Disc,
  Scissors,
  Clock,
  Library,
  Plus,
  Gauge,
  Layers,
  Chip,
} from "@/components/icons";
import {
  PRESETS,
  LENGTHS,
  INSTRUMENTS,
  INSTRUMENT_LEVELS,
  VOCAL_GENDERS,
  VOCAL_TONES,
  VOCAL_AGES,
  LANGUAGES,
  KEYS,
  STYLE_CHIPS,
  STEMS,
  SECTION_TYPES,
  SONG_TEMPLATES,
  sectionById,
  type Engine,
} from "@/lib/presets";
import {
  MASTER_PRESET_META,
  MASTER_METERS,
  MASTER_SLIDERS,
  defaultCustomSettings,
} from "@/lib/masterPresets";

interface Job {
  id: string;
  status: "QUEUED" | "RUNNING" | "COMPLETED" | "FAILED";
  engine: Engine | "tts";
  presetId: string;
  title: string;
  tags: string;
  lyrics: string;
  seconds: number;
  seed: number;
  createdAt: number;
  audioUrl?: string;
  filename?: string;
  error?: string;
  auto?: boolean;
  hasVocals?: boolean;
  reference?: boolean;
  masteredUrl?: string;
  masteredFilename?: string;
  masteredLufs?: number;
  stemsId?: string;
  stems?: Record<string, string>;
  remixUrl?: string;
  remixFilename?: string;
}

interface Status {
  comfy: { ok: boolean; gpu?: string; vramFreeGB?: number };
  models: { ace: boolean; ace15?: boolean; sao: boolean };
  loras?: string[];
  irodori?: boolean;
}

interface Schedule {
  enabled: boolean;
  presetId: string;
  count: number;
  tags: string;
  time: string;
}

interface Album {
  id: string;
  title: string;
  coverUrl?: string;
  trackIds: string[];
  createdAt: number;
  updatedAt: number;
}

type Tab = "simple" | "custom" | "compose" | "narration";

interface Section { id: string; type: string; lyrics: string; }

function fmtTime(ts: number) {
  const d = new Date(ts);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getMonth() + 1}/${d.getDate()} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

const statusBadge: Record<Job["status"], string> = {
  QUEUED: "bg-zinc-700 text-zinc-300",
  RUNNING: "bg-orange-500/20 text-orange-300",
  COMPLETED: "bg-emerald-500/20 text-emerald-300",
  FAILED: "bg-red-500/20 text-red-300",
};
const statusLabel: Record<Job["status"], string> = {
  QUEUED: "待機中",
  RUNNING: "生成中",
  COMPLETED: "完成",
  FAILED: "失敗",
};

function Section({
  title,
  children,
  right,
}: {
  title: string;
  children: React.ReactNode;
  right?: React.ReactNode;
}) {
  return (
    <div className="mb-5">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
          {title}
        </h3>
        {right}
      </div>
      {children}
    </div>
  );
}

export default function StudioPage() {
  const [status, setStatus] = useState<Status | null>(null);
  const [tab, setTab] = useState<Tab>("simple");
  const [jobs, setJobs] = useState<Job[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  // --- 入力状態 ---
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [instrumental, setInstrumental] = useState(false);
  const [lyrics, setLyrics] = useState("");
  const [styleTags, setStyleTags] = useState("");
  const [presetId, setPresetId] = useState("lofi");

  const [vocalGender, setVocalGender] = useState("female");
  const [vocalTones, setVocalTones] = useState<string[]>(["warm"]);
  const [vocalAge, setVocalAge] = useState("any");
  const [vocalLanguage, setVocalLanguage] = useState("auto");

  const [instruments, setInstruments] = useState<Record<string, number>>({});
  const [useBpm, setUseBpm] = useState(false);
  const [bpm, setBpm] = useState(100);
  const [keyName, setKeyName] = useState<string>("指定なし");
  const [lengthId, setLengthId] = useState("normal");
  const [engine, setEngine] = useState<Engine | "auto">("auto");

  const [advanced, setAdvanced] = useState(false);
  const [steps, setSteps] = useState(50);
  const [cfg, setCfg] = useState(5);
  const [temperature, setTemperature] = useState(0.85);
  const [cfgScale, setCfgScale] = useState(2.0);
  const [seedInput, setSeedInput] = useState<string>("");

  const [loraName, setLoraName] = useState("");
  const [loraStrength, setLoraStrength] = useState(1.0);

  // マスタリング（曲ごと）
  const [masterOpen, setMasterOpen] = useState<Record<string, boolean>>({});
  const [masterPreset, setMasterPreset] = useState<Record<string, string>>({});
  const [masterSettings, setMasterSettings] = useState<
    Record<string, Record<string, number>>
  >({});
  const [mastering, setMastering] = useState<Record<string, boolean>>({});

  // ステム編集（曲ごと）
  const [stemOpen, setStemOpen] = useState<Record<string, boolean>>({});
  const [remakeOpen, setRemakeOpen] = useState<Record<string, boolean>>({});
  const [remakeDenoise, setRemakeDenoise] = useState<Record<string, number>>({});
  const [remaking, setRemaking] = useState<Record<string, boolean>>({});
  const [separating, setSeparating] = useState<Record<string, boolean>>({});
  const [remixing, setRemixing] = useState<Record<string, boolean>>({});
  const [gains, setGains] = useState<Record<string, Record<string, number>>>({});
  const [mutes, setMutes] = useState<Record<string, Record<string, boolean>>>({});
  const [vocalClean, setVocalClean] = useState<Record<string, boolean>>({});
  const [fadeOut, setFadeOut] = useState<Record<string, number>>({});

  const [refFile, setRefFile] = useState<string | null>(null);
  const [refName, setRefName] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const [schedule, setSchedule] = useState<Schedule | null>(null);
  const [scheduleOpen, setScheduleOpen] = useState(false);

  // ナレーション（イロドリTTS）
  const [narrText, setNarrText] = useState("");
  const [narrTitle, setNarrTitle] = useState("");
  const [narrRefFile, setNarrRefFile] = useState<string | null>(null);
  const [narrRefName, setNarrRefName] = useState<string | null>(null);
  const [narrUploading, setNarrUploading] = useState(false);
  const narrFileRef = useRef<HTMLInputElement>(null);

  // 作曲モード（構成セクション）
  const [sections, setSections] = useState<Section[]>([
    { id: "s1", type: "intro", lyrics: "" },
    { id: "s2", type: "verse", lyrics: "" },
    { id: "s3", type: "prechorus", lyrics: "" },
    { id: "s4", type: "chorus", lyrics: "" },
    { id: "s5", type: "verse", lyrics: "" },
    { id: "s6", type: "chorus", lyrics: "" },
    { id: "s7", type: "outro", lyrics: "" },
  ]);
  const [secCounter, setSecCounter] = useState(8);
  const [activeSection, setActiveSection] = useState("s4"); // 既定はサビ

  const lyricsRef = useRef<HTMLTextAreaElement>(null);

  // アルバム管理
  const [view, setView] = useState<"library" | "albums">("library");
  const [albums, setAlbums] = useState<Album[]>([]);
  const [selAlbum, setSelAlbum] = useState<string | null>(null);
  const [newAlbumTitle, setNewAlbumTitle] = useState("");
  const [coverUploading, setCoverUploading] = useState(false);
  const [exportMsg, setExportMsg] = useState<string | null>(null);
  const coverFileRef = useRef<HTMLInputElement>(null);

  // --- データ取得 ---
  const loadStatus = useCallback(async () => {
    try {
      const r = await fetch("/api/music-studio/status", { cache: "no-store" });
      if (r.ok) setStatus(await r.json());
    } catch {}
  }, []);
  const loadJobs = useCallback(async () => {
    try {
      const r = await fetch("/api/music-studio/jobs?limit=80", { cache: "no-store" });
      if (r.ok) setJobs((await r.json()).jobs || []);
    } catch {}
  }, []);
  const loadSchedule = useCallback(async () => {
    try {
      const r = await fetch("/api/music-studio/schedule", { cache: "no-store" });
      if (r.ok) setSchedule((await r.json()).schedule);
    } catch {}
  }, []);
  useEffect(() => {
    loadStatus();
    loadJobs();
    loadSchedule();
  }, [loadStatus, loadJobs, loadSchedule]);

  const hasPending = useMemo(
    () => jobs.some((j) => j.status === "QUEUED" || j.status === "RUNNING"),
    [jobs]
  );
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    if (hasPending && !pollRef.current) {
      pollRef.current = setInterval(loadJobs, 4000);
    } else if (!hasPending && pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [hasPending, loadJobs]);

  // --- ヘルパー ---
  const effectiveEngine: Engine =
    engine === "auto"
      ? PRESETS.find((p) => p.id === presetId)?.engine === "sao"
        ? "sao"
        : "ace15"
      : engine;
  const modelReady =
    effectiveEngine === "ace15"
      ? status?.models.ace15
      : effectiveEngine === "ace"
      ? status?.models.ace
      : status?.models.sao;

  const toggleTone = (id: string) =>
    setVocalTones((cur) =>
      cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]
    );

  const appendStyle = (chip: string) =>
    setStyleTags((cur) => {
      const set = cur
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      if (set.includes(chip)) return cur;
      return [...set, chip].join(", ");
    });

  const setInst = (id: string, lvl: number) =>
    setInstruments((cur) => ({ ...cur, [id]: lvl }));

  const insertLyricTag = (tag: string) => {
    const el = lyricsRef.current;
    const ins = `[${tag}]\n`;
    if (!el) {
      setLyrics((c) => c + (c && !c.endsWith("\n") ? "\n" : "") + ins);
      return;
    }
    const start = el.selectionStart;
    const next = lyrics.slice(0, start) + ins + lyrics.slice(start);
    setLyrics(next);
  };

  const uploadRef = async (f: File) => {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", f);
      const r = await fetch("/api/music-studio/upload", { method: "POST", body: fd });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      setRefFile(d.filename);
      setRefName(f.name);
    } catch (e) {
      setMessage(`参照音声のアップロード失敗: ${String(e)}`);
    } finally {
      setUploading(false);
    }
  };

  const generate = async () => {
    setSubmitting(true);
    setMessage(null);
    try {
      const seconds = LENGTHS.find((l) => l.id === lengthId)?.seconds ?? 150;
      const body: Record<string, unknown> = {
        mode: tab,
        title: title || undefined,
        engine: engine === "auto" ? undefined : engine,
        seconds: effectiveEngine === "sao" ? Math.min(seconds, 45) : seconds,
      };
      if (tab === "simple") {
        body.presetId = presetId;
        body.description = description;
        body.instrumental = instrumental;
      } else {
        body.presetId = presetId;
        body.description = description || undefined;
        body.styleTags = styleTags || undefined;
        body.instrumental = instrumental;
        body.lyrics = instrumental ? undefined : lyrics;
        body.instruments = instruments;
        body.bpm = useBpm ? bpm : undefined;
        body.key = keyName;
        body.referenceAudioFile = refFile || undefined;
        if (!instrumental) {
          body.vocal = {
            gender: vocalGender,
            tones: vocalTones,
            age: vocalAge,
            language: vocalLanguage,
          };
        }
        if (loraName) {
          body.loraName = loraName;
          body.loraStrength = loraStrength;
        }
        if (advanced) {
          body.steps = steps;
          body.cfg = cfg;
          body.temperature = temperature;
          body.cfgScale = cfgScale;
          if (seedInput.trim() && !Number.isNaN(Number(seedInput)))
            body.seed = Number(seedInput);
        }
      }
      const r = await fetch("/api/music-studio/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "生成に失敗しました");
      setMessage("生成キューに追加しました。右のライブラリに出ます（1〜3分）。");
      await loadJobs();
    } catch (e) {
      setMessage(`エラー: ${String(e)}`);
    } finally {
      setSubmitting(false);
    }
  };

  const runMaster = async (jobId: string) => {
    setMastering((m) => ({ ...m, [jobId]: true }));
    try {
      const choice = masterPreset[jobId] || "natural";
      const body: Record<string, unknown> = { jobId };
      if (choice === "custom") {
        body.settings = masterSettings[jobId] || defaultCustomSettings();
      } else {
        body.preset = choice;
      }
      const r = await fetch("/api/music-studio/master", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "マスタリング失敗");
      await loadJobs();
      setMasterOpen((m) => ({ ...m, [jobId]: false }));
    } catch (e) {
      setMessage(`マスタリング: ${String(e)}`);
    } finally {
      setMastering((m) => ({ ...m, [jobId]: false }));
    }
  };

  const pickMaster = (jobId: string, id: string) =>
    setMasterPreset((m) => ({ ...m, [jobId]: id }));
  const setCustom = (jobId: string, key: string, val: number) =>
    setMasterSettings((m) => ({
      ...m,
      [jobId]: { ...(m[jobId] || defaultCustomSettings()), [key]: val },
    }));

  // ステム分離
  const runRemake = async (jobId: string) => {
    setRemaking((m) => ({ ...m, [jobId]: true }));
    setMessage(null);
    try {
      const r = await fetch("/api/music-studio/remake", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId, denoise: remakeDenoise[jobId] ?? 0.6 }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "作り直し失敗");
      setMessage("作り直しを開始しました（1〜2分でライブラリに追加）。");
      setRemakeOpen((m) => ({ ...m, [jobId]: false }));
      await loadJobs();
    } catch (e) {
      setMessage(`作り直し: ${String(e)}`);
    } finally {
      setRemaking((m) => ({ ...m, [jobId]: false }));
    }
  };

  const runSeparate = async (jobId: string) => {
    setSeparating((m) => ({ ...m, [jobId]: true }));
    setStemOpen((m) => ({ ...m, [jobId]: true }));
    try {
      const r = await fetch("/api/music-studio/stems", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "分離失敗");
      await loadJobs();
    } catch (e) {
      setMessage(`ステム分離: ${String(e)}`);
    } finally {
      setSeparating((m) => ({ ...m, [jobId]: false }));
    }
  };

  const setGain = (jobId: string, stem: string, db: number) =>
    setGains((g) => ({ ...g, [jobId]: { ...(g[jobId] || {}), [stem]: db } }));
  const toggleMute = (jobId: string, stem: string) =>
    setMutes((m) => ({
      ...m,
      [jobId]: { ...(m[jobId] || {}), [stem]: !(m[jobId]?.[stem]) },
    }));

  const runRemix = async (jobId: string, stemsId: string) => {
    setRemixing((m) => ({ ...m, [jobId]: true }));
    try {
      const r = await fetch("/api/music-studio/remix", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jobId,
          stemsId,
          gains: gains[jobId] || {},
          mutes: mutes[jobId] || {},
          vocalCleanup: !!vocalClean[jobId],
          fadeOut: fadeOut[jobId] || 0,
        }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "リミックス失敗");
      await loadJobs();
    } catch (e) {
      setMessage(`リミックス: ${String(e)}`);
    } finally {
      setRemixing((m) => ({ ...m, [jobId]: false }));
    }
  };

  const uploadNarrRef = async (f: File) => {
    setNarrUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", f);
      const r = await fetch("/api/music-studio/upload", { method: "POST", body: fd });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      setNarrRefFile(d.filename);
      setNarrRefName(f.name);
    } catch (e) {
      setMessage(`参照音声のアップロード失敗: ${String(e)}`);
    } finally {
      setNarrUploading(false);
    }
  };

  const generateNarration = async () => {
    setSubmitting(true);
    setMessage(null);
    try {
      const r = await fetch("/api/music-studio/narration", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: narrText,
          title: title || undefined,
          refWavFile: narrRefFile || undefined,
        }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "生成に失敗しました");
      setMessage("ナレーションを生成しました（CPUだと1〜3分かかります）。");
      await loadJobs();
    } catch (e) {
      setMessage(`エラー: ${String(e)}`);
    } finally {
      setSubmitting(false);
    }
  };

  const insertEmoji = (emo: string) => setNarrText((t) => t + emo);

  // ---- 作曲モード ----
  const addSection = (type: string) => {
    const nid = `s${secCounter}`;
    setSecCounter((c) => c + 1);
    setSections((s) => [...s, { id: nid, type, lyrics: "" }]);
    setActiveSection(nid);
  };
  const removeSection = (id: string) =>
    setSections((s) => {
      const next = s.filter((x) => x.id !== id);
      if (id === activeSection) setActiveSection(next[0]?.id ?? "");
      return next;
    });
  const moveSection = (idx: number, dir: -1 | 1) =>
    setSections((s) => {
      const arr = [...s];
      const j = idx + dir;
      if (j < 0 || j >= arr.length) return s;
      [arr[idx], arr[j]] = [arr[j], arr[idx]];
      return arr;
    });
  const setSectionLyrics = (id: string, lyrics: string) =>
    setSections((s) => s.map((x) => (x.id === id ? { ...x, lyrics } : x)));
  const setSectionType = (id: string, type: string) =>
    setSections((s) => s.map((x) => (x.id === id ? { ...x, type } : x)));

  // 構成 → ACE-Step 構造付き歌詞へコンパイル
  const compileSections = (): { lyrics: string; instrumental: boolean } => {
    const lines: string[] = [];
    let anyVocal = false;
    for (const sec of sections) {
      const t = sectionById(sec.type);
      lines.push(`[${t.tag}]`);
      const ly = sec.lyrics.trim();
      if (ly) {
        lines.push(ly);
        anyVocal = true;
      }
      lines.push("");
    }
    return { lyrics: lines.join("\n").trim(), instrumental: !anyVocal };
  };

  const applyTemplate = (sectionIds: string[]) => {
    let c = secCounter;
    const next = sectionIds.map((type) => ({ id: `s${c++}`, type, lyrics: "" }));
    setSections(next);
    setSecCounter(c);
    setActiveSection(next.find((s) => s.type === "chorus")?.id ?? next[0]?.id ?? "");
  };

  const generateCompose = async () => {
    setSubmitting(true);
    setMessage(null);
    try {
      const { lyrics, instrumental } = compileSections();
      const seconds = LENGTHS.find((l) => l.id === lengthId)?.seconds ?? 180;
      const body: Record<string, unknown> = {
        mode: "custom",
        engine: "ace15",
        title: title || undefined,
        presetId,
        styleTags: styleTags || undefined,
        description: description || undefined,
        instrumental,
        lyrics: instrumental ? undefined : lyrics,
        bpm: useBpm ? bpm : undefined,
        key: keyName,
        seconds,
      };
      if (!instrumental) {
        body.vocal = {
          gender: vocalGender,
          tones: vocalTones,
          age: vocalAge,
          language: vocalLanguage,
        };
      }
      const r = await fetch("/api/music-studio/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "生成に失敗しました");
      setMessage("構成から生成を開始しました（ACE-Step 1.5・1〜3分）。");
      await loadJobs();
    } catch (e) {
      setMessage(`エラー: ${String(e)}`);
    } finally {
      setSubmitting(false);
    }
  };

  // ---- アルバム ----
  const loadAlbums = useCallback(async () => {
    try {
      const r = await fetch("/api/music-studio/albums", { cache: "no-store" });
      if (r.ok) setAlbums((await r.json()).albums || []);
    } catch {}
  }, []);
  useEffect(() => {
    loadAlbums();
  }, [loadAlbums]);

  const createAlbumH = async () => {
    const r = await fetch("/api/music-studio/albums", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: newAlbumTitle || "無題のアルバム" }),
    });
    if (r.ok) {
      const d = await r.json();
      setNewAlbumTitle("");
      await loadAlbums();
      setSelAlbum(d.album.id);
    }
  };
  const patchAlbum = async (id: string, patch: Partial<Album>) => {
    const r = await fetch("/api/music-studio/albums", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, ...patch }),
    });
    if (r.ok) await loadAlbums();
  };
  const deleteAlbumH = async (id: string) => {
    await fetch("/api/music-studio/albums", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    if (selAlbum === id) setSelAlbum(null);
    await loadAlbums();
  };
  const uploadCover = async (albumId: string, f: File) => {
    setCoverUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", f);
      fd.append("albumId", albumId);
      const r = await fetch("/api/music-studio/albums/cover", { method: "POST", body: fd });
      if (r.ok) await loadAlbums();
    } finally {
      setCoverUploading(false);
    }
  };
  const albumAddTrack = (album: Album, jobId: string) =>
    patchAlbum(album.id, { trackIds: [...album.trackIds, jobId] });
  const albumRemoveTrack = (album: Album, jobId: string) =>
    patchAlbum(album.id, { trackIds: album.trackIds.filter((t) => t !== jobId) });
  const albumMove = (album: Album, idx: number, dir: -1 | 1) => {
    const arr = [...album.trackIds];
    const j = idx + dir;
    if (j < 0 || j >= arr.length) return;
    [arr[idx], arr[j]] = [arr[j], arr[idx]];
    patchAlbum(album.id, { trackIds: arr });
  };
  const exportAlbum = async (id: string) => {
    setExportMsg("書き出し中…");
    try {
      const r = await fetch("/api/music-studio/albums/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      setExportMsg(`✅ 書き出し完了（${d.tracks}曲）: ${d.folder}`);
    } catch (e) {
      setExportMsg(`エラー: ${String(e)}`);
    }
  };

  const saveSchedule = async (patch: Partial<Schedule>) => {
    const r = await fetch("/api/music-studio/schedule", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    if (r.ok) setSchedule((await r.json()).schedule);
  };

  const completed = jobs.filter((j) => j.status === "COMPLETED" && j.audioUrl);
  const vocalsDisabled = instrumental;

  return (
    <div className="flex h-screen overflow-hidden bg-zinc-950 text-zinc-100">
      {/* 左：クリエイター（主役・広め） */}
      <aside className="w-[58%] min-w-[560px] max-w-[960px] flex-none border-r border-zinc-800 flex flex-col">
        {/* ロゴ */}
        <div className="flex-none px-5 py-4 border-b border-zinc-800 flex items-center gap-2">
          <Link href="/" className="flex items-center gap-2 hover:opacity-80">
            <Logo size={24} />
            <span className="text-lg font-bold tracking-tight">
              FORGE
              <span className="text-[var(--accent)]">.</span>
            </span>
          </Link>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400 ml-1 font-mono">
            LOCAL
          </span>
        </div>

        {/* タブ */}
        <div className="flex-none px-4 pt-4">
          <div className="flex gap-1 p-1 rounded-lg bg-zinc-900 border border-zinc-800">
            {(["simple", "custom", "compose", "narration"] as Tab[]).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`flex-1 py-1.5 rounded-md text-[11px] font-medium transition ${
                  tab === t
                    ? "bg-zinc-100 text-zinc-900"
                    : "text-zinc-400 hover:text-zinc-200"
                }`}
              >
                {t === "simple" ? (
                  "かんたん"
                ) : t === "custom" ? (
                  "カスタム"
                ) : t === "compose" ? (
                  "作曲"
                ) : (
                  <span className="inline-flex items-center gap-1">
                    <Voice size={12} />
                    ナレ
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* スクロール領域 */}
        <div
          className={
            tab === "custom"
              ? "flex-1 overflow-y-auto px-6 py-5 lg:columns-2 gap-8 [&>*]:break-inside-avoid"
              : tab === "compose"
              ? "flex-1 overflow-y-auto px-6 py-5"
              : "flex-1 overflow-y-auto px-6 py-5 max-w-2xl"
          }
        >
          {/* タイトル */}
          <Section title="タイトル">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="無題の曲"
              className="w-full rounded-lg bg-zinc-900 border border-zinc-800 px-3 py-2 text-sm focus:outline-none focus:border-orange-500"
            />
          </Section>

          {tab === "simple" ? (
            <>
              <Section title="曲のイメージ">
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={4}
                  placeholder="例: 雨の夜、切ないピアノ、女性ボーカルのバラード（英語で書くと安定します）"
                  className="w-full rounded-lg bg-zinc-900 border border-zinc-800 px-3 py-2 text-sm focus:outline-none focus:border-orange-500"
                />
              </Section>
              <Section title="ベースの雰囲気">
                <div className="flex flex-wrap gap-1.5">
                  {PRESETS.filter((p) => p.engine === "ace").map((p) => (
                    <button
                      key={p.id}
                      onClick={() => setPresetId(p.id)}
                      className={`px-2.5 py-1.5 rounded-lg text-xs border transition ${
                        presetId === p.id
                          ? "bg-orange-600 border-orange-500 text-white"
                          : "bg-zinc-900 border-zinc-800 text-zinc-300 hover:border-zinc-600"
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
                <p className="text-[11px] text-zinc-500 mt-1.5">
                  {PRESETS.find((p) => p.id === presetId)?.desc}
                </p>
              </Section>
              <label className="flex items-center gap-2 text-sm text-zinc-300 mb-4">
                <input
                  type="checkbox"
                  checked={instrumental}
                  onChange={(e) => setInstrumental(e.target.checked)}
                  className="accent-orange"
                />
                インスト（歌なし）
              </label>
            </>
          ) : tab === "narration" ? (
            <>
              <Section title="ナレーション本文（日本語）">
                <textarea
                  value={narrText}
                  onChange={(e) => setNarrText(e.target.value)}
                  rows={5}
                  placeholder="ここに読み上げたい日本語を入力。文中に絵文字を入れると感情がつきます。"
                  className="w-full rounded-lg bg-zinc-900 border border-zinc-800 px-3 py-2 text-sm focus:outline-none focus:border-orange-500"
                />
                <div className="flex flex-wrap gap-1 mt-1.5">
                  {[
                    { e: "😊", l: "喜" },
                    { e: "😢", l: "悲" },
                    { e: "😠", l: "怒" },
                    { e: "😲", l: "驚" },
                    { e: "🥰", l: "優" },
                    { e: "😌", l: "落ち着き" },
                  ].map((x) => (
                    <button
                      key={x.e}
                      onClick={() => insertEmoji(x.e)}
                      className="px-2 py-1 rounded-md text-[11px] bg-zinc-900 border border-zinc-800 text-zinc-300 hover:border-orange-500"
                      title={`感情: ${x.l}`}
                    >
                      {x.e} {x.l}
                    </button>
                  ))}
                </div>
              </Section>

              <Section title="声（自分の声にクローンも可）">
                <input
                  ref={narrFileRef}
                  type="file"
                  accept="audio/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) uploadNarrRef(f);
                  }}
                />
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => narrFileRef.current?.click()}
                    disabled={narrUploading}
                    className="px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-800 text-sm text-zinc-200 hover:border-orange-500"
                  >
                    <span className="inline-flex items-center gap-1.5">
                      <Mic size={14} />
                      {narrUploading ? "アップロード中…" : "参照音声で声クローン"}
                    </span>
                  </button>
                  {narrRefName ? (
                    <span className="text-xs text-emerald-300 truncate max-w-[160px]">
                      {narrRefName}
                    </span>
                  ) : (
                    <span className="text-xs text-zinc-500">未選択なら標準の声</span>
                  )}
                  {narrRefFile && (
                    <button
                      onClick={() => {
                        setNarrRefFile(null);
                        setNarrRefName(null);
                      }}
                      className="text-xs text-zinc-500 hover:text-zinc-300"
                    >
                      解除
                    </button>
                  )}
                </div>
                <p className="text-[11px] text-zinc-500 mt-1.5 leading-relaxed">
                  自分の声、または利用許諾のある音源だけを使ってください。
                  {status && status.irodori === false && (
                    <span className="text-amber-400">
                      {" "}
                      ※Irodori-TTSサーバーが未起動です（`npm run irodori`）。
                    </span>
                  )}
                </p>
              </Section>
              <p className="text-[11px] text-zinc-500 mb-2">
                ナレーションはライブラリに追加され、分解・編集で曲と重ねる（ミックス）こともできます。
              </p>
            </>
          ) : tab === "compose" ? (
            <>
              {/* テンプレート */}
              <div className="flex flex-wrap items-center gap-1.5 mb-3">
                <span className="text-[11px] text-zinc-500 mr-1">テンプレ:</span>
                {SONG_TEMPLATES.map((tp) => (
                  <button
                    key={tp.id}
                    onClick={() => applyTemplate(tp.sections)}
                    className="text-[11px] px-2.5 py-1 rounded-md border border-zinc-800 bg-zinc-900/50 text-zinc-300 hover:border-orange-500"
                    title={tp.desc}
                  >
                    {tp.label}
                  </button>
                ))}
              </div>

              {/* アレンジ・タイムライン（DAW風） */}
              <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-3 mb-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                    アレンジ（曲の流れ）
                  </span>
                  <span className="text-[10px] text-zinc-600">
                    ブロックをクリックで編集
                  </span>
                </div>
                <div className="flex items-stretch gap-1 overflow-x-auto pb-1 min-h-[56px]">
                  {sections.length === 0 ? (
                    <span className="text-[11px] text-zinc-600 self-center px-2">
                      下の＋から構成を組み立ててください
                    </span>
                  ) : (
                    sections.map((sec, idx) => {
                      const st = sectionById(sec.type);
                      const active = sec.id === activeSection;
                      const words = sec.lyrics.trim()
                        ? sec.lyrics.trim().replace(/\s+/g, "").length
                        : 0;
                      return (
                        <button
                          key={sec.id}
                          onClick={() => setActiveSection(sec.id)}
                          className={`group relative flex-none w-24 rounded-lg px-2 py-1.5 text-left transition ${
                            active ? "ring-2 ring-white" : "hover:brightness-110"
                          }`}
                          style={{ background: st.color + (active ? "" : "cc") }}
                          title={st.label}
                        >
                          <div className="text-[11px] font-bold text-white/95 leading-none">
                            {st.label}
                          </div>
                          <div className="text-[9px] text-white/70 mt-1 leading-none">
                            {st.defaultInstrumental && !words
                              ? "演奏"
                              : words
                              ? `${words}字`
                              : "歌詞なし"}
                          </div>
                          <span className="absolute top-0.5 right-1 text-[9px] text-white/60 font-mono">
                            {idx + 1}
                          </span>
                        </button>
                      );
                    })
                  )}
                </div>
                {/* セクション追加 */}
                <div className="flex flex-wrap gap-1 mt-2 pt-2 border-t border-zinc-800">
                  {SECTION_TYPES.map((x) => (
                    <button
                      key={x.id}
                      onClick={() => addSection(x.id)}
                      className="text-[10px] px-1.5 py-0.5 rounded border border-zinc-800 hover:brightness-125 inline-flex items-center gap-0.5"
                      style={{ color: x.color }}
                    >
                      <Plus size={10} /> {x.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* 選択セクションの歌詞エディタ（大きめ） */}
              {(() => {
                const idx = sections.findIndex((s) => s.id === activeSection);
                const sec = sections[idx];
                if (!sec) {
                  return (
                    <p className="text-sm text-zinc-500 py-8 text-center">
                      上のアレンジからセクションを選ぶか、＋で追加してください。
                    </p>
                  );
                }
                const st = sectionById(sec.type);
                return (
                  <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-3 mb-4">
                    <div className="flex items-center gap-2 mb-2">
                      <span
                        className="w-3 h-3 rounded-sm flex-none"
                        style={{ background: st.color }}
                      />
                      <select
                        value={sec.type}
                        onChange={(e) => setSectionType(sec.id, e.target.value)}
                        className="rounded bg-zinc-950 border border-zinc-800 px-2 py-1 text-sm font-semibold"
                        style={{ color: st.color }}
                      >
                        {SECTION_TYPES.map((x) => (
                          <option key={x.id} value={x.id}>
                            {x.label}
                          </option>
                        ))}
                      </select>
                      <span className="text-[11px] text-zinc-500 flex-1 truncate">
                        {st.hint}
                      </span>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() =>
                            setActiveSection(sections[Math.max(0, idx - 1)].id)
                          }
                          disabled={idx === 0}
                          className="text-xs text-zinc-500 hover:text-zinc-200 px-1 disabled:opacity-30"
                        >
                          ‹前
                        </button>
                        <button
                          onClick={() =>
                            setActiveSection(
                              sections[Math.min(sections.length - 1, idx + 1)].id
                            )
                          }
                          disabled={idx === sections.length - 1}
                          className="text-xs text-zinc-500 hover:text-zinc-200 px-1 disabled:opacity-30"
                        >
                          次›
                        </button>
                        <span className="w-px h-4 bg-zinc-700 mx-1" />
                        <button onClick={() => moveSection(idx, -1)} className="text-xs text-zinc-500 hover:text-zinc-200 px-1">↑</button>
                        <button onClick={() => moveSection(idx, 1)} className="text-xs text-zinc-500 hover:text-zinc-200 px-1">↓</button>
                        <button onClick={() => removeSection(sec.id)} className="text-xs text-red-300 hover:text-red-200 px-1">×</button>
                      </div>
                    </div>
                    <textarea
                      value={sec.lyrics}
                      onChange={(e) => setSectionLyrics(sec.id, e.target.value)}
                      rows={8}
                      placeholder={
                        st.defaultInstrumental
                          ? "（空欄で演奏のみ。歌詞を入れると歌います）\nこの区間の歌詞をここに…"
                          : st.label + "の歌詞をここに大きく書けます…"
                      }
                      className="w-full rounded-lg bg-zinc-950 border border-zinc-800 px-3 py-2.5 text-sm leading-relaxed focus:outline-none focus:border-orange-500 resize-y"
                    />
                    <div className="text-[10px] text-zinc-600 mt-1 text-right">
                      {sec.lyrics.trim().replace(/\s+/g, "").length} 文字
                    </div>
                  </div>
                );
              })()}

              {/* スタイル */}
              <Section title="スタイル / ジャンル">
                <input
                  value={styleTags}
                  onChange={(e) => setStyleTags(e.target.value)}
                  placeholder="例: j-pop, band, emotional"
                  className="w-full rounded-lg bg-zinc-900 border border-zinc-800 px-3 py-2 text-sm mb-2 focus:outline-none focus:border-orange-500"
                />
                <div className="flex flex-wrap gap-1.5">
                  {STYLE_CHIPS.slice(0, 12).map((c) => (
                    <button
                      key={c}
                      onClick={() => appendStyle(c)}
                      className="px-2 py-1 rounded-md text-[11px] bg-zinc-900 border border-zinc-800 text-zinc-400 hover:border-orange-500 hover:text-zinc-100"
                    >
                      + {c}
                    </button>
                  ))}
                </div>
              </Section>

              {/* ボーカル・音楽設定 */}
              <Section title="ボーカル・音楽設定">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  <select value={vocalGender} onChange={(e) => setVocalGender(e.target.value)} className="rounded-lg bg-zinc-900 border border-zinc-800 px-2 py-2 text-sm">
                    {VOCAL_GENDERS.map((g) => (<option key={g.id} value={g.id}>{g.label}</option>))}
                  </select>
                  <select value={vocalLanguage} onChange={(e) => setVocalLanguage(e.target.value)} className="rounded-lg bg-zinc-900 border border-zinc-800 px-2 py-2 text-sm">
                    {LANGUAGES.map((l) => (<option key={l.id} value={l.id}>{l.label}</option>))}
                  </select>
                  <select value={keyName} onChange={(e) => setKeyName(e.target.value)} className="rounded-lg bg-zinc-900 border border-zinc-800 px-2 py-2 text-sm">
                    {KEYS.map((k) => (<option key={k} value={k}>{k}</option>))}
                  </select>
                  <select value={lengthId} onChange={(e) => setLengthId(e.target.value)} className="rounded-lg bg-zinc-900 border border-zinc-800 px-2 py-2 text-sm">
                    {LENGTHS.map((l) => (<option key={l.id} value={l.id}>{l.label}</option>))}
                  </select>
                </div>
                <label className="flex items-center gap-2 text-xs text-zinc-300 mt-2">
                  <input type="checkbox" checked={useBpm} onChange={(e) => setUseBpm(e.target.checked)} className="accent-orange" />
                  BPM指定
                  {useBpm && (<input type="range" min={60} max={200} value={bpm} onChange={(e) => setBpm(Number(e.target.value))} className="flex-1 max-w-xs" />)}
                  {useBpm && <span className="font-mono text-[11px]">{bpm}</span>}
                </label>
              </Section>
            </>
          ) : (
            <>
              {/* 歌詞 */}
              <Section
                title="歌詞"
                right={
                  <label className="flex items-center gap-1.5 text-xs text-zinc-400">
                    <input
                      type="checkbox"
                      checked={instrumental}
                      onChange={(e) => setInstrumental(e.target.checked)}
                      className="accent-orange"
                    />
                    インスト
                  </label>
                }
              >
                {!instrumental && (
                  <>
                    <div className="flex gap-1 mb-1.5">
                      {["verse", "chorus", "bridge", "outro"].map((t) => (
                        <button
                          key={t}
                          onClick={() => insertLyricTag(t)}
                          className="px-2 py-0.5 rounded bg-zinc-800 text-[11px] text-zinc-300 hover:bg-zinc-700"
                        >
                          [{t}]
                        </button>
                      ))}
                    </div>
                    <textarea
                      ref={lyricsRef}
                      value={lyrics}
                      onChange={(e) => setLyrics(e.target.value)}
                      rows={6}
                      placeholder={"[verse]\n歌詞をここに...\n[chorus]\nサビをここに..."}
                      className="w-full rounded-lg bg-zinc-900 border border-zinc-800 px-3 py-2 text-sm font-mono focus:outline-none focus:border-orange-500"
                    />
                  </>
                )}
                {instrumental && (
                  <p className="text-xs text-zinc-500">インストで生成します（歌なし）。</p>
                )}
              </Section>

              {/* スタイル */}
              <Section title="スタイル / ジャンル">
                <input
                  value={styleTags}
                  onChange={(e) => setStyleTags(e.target.value)}
                  placeholder="例: city pop, funky bass, 80s"
                  className="w-full rounded-lg bg-zinc-900 border border-zinc-800 px-3 py-2 text-sm mb-2 focus:outline-none focus:border-orange-500"
                />
                <div className="flex flex-wrap gap-1.5">
                  {STYLE_CHIPS.map((c) => (
                    <button
                      key={c}
                      onClick={() => appendStyle(c)}
                      className="px-2 py-1 rounded-md text-[11px] bg-zinc-900 border border-zinc-800 text-zinc-400 hover:border-orange-500 hover:text-zinc-100"
                    >
                      + {c}
                    </button>
                  ))}
                </div>
              </Section>

              {/* ボーカル */}
              <Section title="ボーカル">
                <div
                  className={
                    vocalsDisabled ? "opacity-40 pointer-events-none" : undefined
                  }
                >
                  <div className="grid grid-cols-2 gap-2 mb-2">
                    <select
                      value={vocalGender}
                      onChange={(e) => setVocalGender(e.target.value)}
                      className="rounded-lg bg-zinc-900 border border-zinc-800 px-2 py-2 text-sm"
                    >
                      {VOCAL_GENDERS.filter((g) => g.id !== "none").map((g) => (
                        <option key={g.id} value={g.id}>
                          {g.label}
                        </option>
                      ))}
                    </select>
                    <select
                      value={vocalAge}
                      onChange={(e) => setVocalAge(e.target.value)}
                      className="rounded-lg bg-zinc-900 border border-zinc-800 px-2 py-2 text-sm"
                    >
                      {VOCAL_AGES.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {VOCAL_TONES.map((t) => (
                      <button
                        key={t.id}
                        onClick={() => toggleTone(t.id)}
                        className={`px-2 py-1 rounded-md text-[11px] border transition ${
                          vocalTones.includes(t.id)
                            ? "bg-orange-600/30 border-orange-500 text-orange-200"
                            : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:border-zinc-600"
                        }`}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>
                  <select
                    value={vocalLanguage}
                    onChange={(e) => setVocalLanguage(e.target.value)}
                    className="w-full rounded-lg bg-zinc-900 border border-zinc-800 px-2 py-2 text-sm"
                  >
                    {LANGUAGES.map((l) => (
                      <option key={l.id} value={l.id}>
                        言語: {l.label}
                      </option>
                    ))}
                  </select>
                </div>
              </Section>

              {/* 声を寄せる（参照音声） */}
              <Section title="声・音色を寄せる（参照音声）">
                <div
                  className={
                    vocalsDisabled ? "opacity-40 pointer-events-none" : undefined
                  }
                >
                  <input
                    ref={fileRef}
                    type="file"
                    accept="audio/*"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) uploadRef(f);
                    }}
                  />
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => fileRef.current?.click()}
                      disabled={uploading}
                      className="px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-800 text-sm text-zinc-200 hover:border-orange-500"
                    >
                      <span className="inline-flex items-center gap-1.5">
                      <Mic size={14} />
                      {uploading ? "アップロード中…" : "音声を選ぶ"}
                    </span>
                    </button>
                    {refName && (
                      <span className="text-xs text-emerald-300 truncate max-w-[180px]">
                        {refName}
                      </span>
                    )}
                    {refFile && (
                      <button
                        onClick={() => {
                          setRefFile(null);
                          setRefName(null);
                        }}
                        className="text-xs text-zinc-500 hover:text-zinc-300"
                      >
                        解除
                      </button>
                    )}
                  </div>
                  <p className="text-[11px] text-zinc-500 mt-1.5 leading-relaxed">
                    アップした音源の音色・声質に寄せて生成します。自分の声、または
                    利用許諾のある音源を使ってください（実在人物の声の無断模倣はしないでください）。
                  </p>
                </div>
              </Section>

              {/* 楽器ミキサー */}
              <Section title="楽器ミキサー">
                <div className="space-y-2">
                  {INSTRUMENTS.map((inst) => {
                    const lvl = instruments[inst.id] ?? 0;
                    return (
                      <div key={inst.id} className="flex items-center gap-2">
                        <span className="w-24 text-sm text-zinc-300 flex-none">
                          {inst.label}
                        </span>
                        <input
                          type="range"
                          min={0}
                          max={4}
                          step={1}
                          value={lvl}
                          onChange={(e) => setInst(inst.id, Number(e.target.value))}
                          className="flex-1"
                        />
                        <span
                          className={`w-14 text-[11px] text-right flex-none ${
                            lvl === 0 ? "text-zinc-600" : "text-orange-300"
                          }`}
                        >
                          {INSTRUMENT_LEVELS[lvl]}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </Section>

              {/* 音楽設定 */}
              <Section title="音楽設定">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <label className="flex items-center gap-1.5 text-sm text-zinc-300 w-24 flex-none">
                      <input
                        type="checkbox"
                        checked={useBpm}
                        onChange={(e) => setUseBpm(e.target.checked)}
                        className="accent-orange"
                      />
                      BPM
                    </label>
                    <input
                      type="range"
                      min={60}
                      max={200}
                      step={1}
                      value={bpm}
                      disabled={!useBpm}
                      onChange={(e) => setBpm(Number(e.target.value))}
                      className="flex-1 disabled:opacity-40"
                    />
                    <span className="w-14 text-right text-[11px] text-zinc-300">
                      {useBpm ? `${bpm}` : "自動"}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <select
                      value={keyName}
                      onChange={(e) => setKeyName(e.target.value)}
                      className="rounded-lg bg-zinc-900 border border-zinc-800 px-2 py-2 text-sm"
                    >
                      {KEYS.map((k) => (
                        <option key={k} value={k}>
                          キー: {k}
                        </option>
                      ))}
                    </select>
                    <select
                      value={lengthId}
                      onChange={(e) => setLengthId(e.target.value)}
                      className="rounded-lg bg-zinc-900 border border-zinc-800 px-2 py-2 text-sm"
                    >
                      {LENGTHS.map((l) => (
                        <option key={l.id} value={l.id}>
                          {l.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <select
                    value={engine}
                    onChange={(e) => setEngine(e.target.value as Engine | "auto")}
                    className="w-full rounded-lg bg-zinc-900 border border-zinc-800 px-2 py-2 text-sm"
                  >
                    <option value="auto">エンジン: おまかせ</option>
                    <option value="ace15">ACE-Step 1.5（歌が安定・推奨）</option>
                    <option value="ace">ACE-Step v1（声寄せ/LoRA対応）</option>
                    <option value="sao">Stable Audio（SE・ループ）</option>
                  </select>
                </div>
              </Section>

              {/* 音色モデル(LoRA) */}
              <Section title="音色モデル（LoRA）">
                {status?.loras && status.loras.length > 0 ? (
                  <>
                    <select
                      value={loraName}
                      onChange={(e) => setLoraName(e.target.value)}
                      className="w-full rounded-lg bg-zinc-900 border border-zinc-800 px-2 py-2 text-sm mb-2"
                    >
                      <option value="">なし（基本モデル）</option>
                      {status.loras.map((l) => (
                        <option key={l} value={l}>
                          {l}
                        </option>
                      ))}
                    </select>
                    {loraName && (
                      <div className="flex items-center gap-2">
                        <span className="w-24 text-sm text-zinc-300 flex-none">強さ</span>
                        <input
                          type="range"
                          min={0}
                          max={1.5}
                          step={0.05}
                          value={loraStrength}
                          onChange={(e) => setLoraStrength(Number(e.target.value))}
                          className="flex-1"
                        />
                        <span className="w-10 text-right text-[11px] text-zinc-300">
                          {loraStrength.toFixed(2)}
                        </span>
                      </div>
                    )}
                  </>
                ) : (
                  <p className="text-[11px] text-zinc-500 leading-relaxed">
                    まだ音色モデルがありません。自分の曲・声で LoRA を学習すると、
                    「自分だけの音色」で生成できます。作り方は{" "}
                    <code className="bg-zinc-800 px-1 rounded">training/README.md</code>。
                  </p>
                )}
              </Section>

              {/* 詳細 */}
              <button
                onClick={() => setAdvanced((v) => !v)}
                className="text-xs text-zinc-500 hover:text-zinc-300 mb-2"
              >
                エキスパート設定{advanced ? " ▲" : " ▼"}
              </button>
              {advanced && (
                <div className="space-y-2.5 mb-4 p-3 rounded-lg bg-zinc-900/60 border border-zinc-800">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="w-28 text-sm text-zinc-300 flex-none">創造性</span>
                      <input
                        type="range"
                        min={0.5}
                        max={1.3}
                        step={0.05}
                        value={temperature}
                        onChange={(e) => setTemperature(Number(e.target.value))}
                        className="flex-1"
                      />
                      <span className="w-10 text-right text-[11px] text-zinc-300">
                        {temperature.toFixed(2)}
                      </span>
                    </div>
                    <p className="text-[10px] text-zinc-500 ml-28">
                      上げるほど大胆・意外性、下げるほど安定・無難
                    </p>
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="w-28 text-sm text-zinc-300 flex-none">忠実さ</span>
                      <input
                        type="range"
                        min={1.2}
                        max={5}
                        step={0.1}
                        value={cfgScale}
                        onChange={(e) => setCfgScale(Number(e.target.value))}
                        className="flex-1"
                      />
                      <span className="w-10 text-right text-[11px] text-zinc-300">
                        {cfgScale.toFixed(1)}
                      </span>
                    </div>
                    <p className="text-[10px] text-zinc-500 ml-28">
                      上げるほど歌詞・スタイル指定に忠実
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-28 text-sm text-zinc-300 flex-none">品質(steps)</span>
                    <input
                      type="range"
                      min={20}
                      max={100}
                      value={steps}
                      onChange={(e) => setSteps(Number(e.target.value))}
                      className="flex-1"
                    />
                    <span className="w-10 text-right text-[11px] text-zinc-300">
                      {steps}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-28 text-sm text-zinc-300 flex-none">シード</span>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={seedInput}
                      onChange={(e) => setSeedInput(e.target.value)}
                      placeholder="空=ランダム"
                      className="flex-1 rounded bg-zinc-950 border border-zinc-800 px-2 py-1.5 text-xs"
                    />
                    <button
                      onClick={() =>
                        setSeedInput(String(Math.floor(Math.random() * 2 ** 31)))
                      }
                      className="text-[11px] text-zinc-400 hover:text-zinc-200"
                    >
                      🎲
                    </button>
                  </div>
                  <p className="text-[10px] text-zinc-500">
                    同じシード＋同じ設定なら同じ曲になります（再現・微調整に）
                  </p>
                </div>
              )}
            </>
          )}
        </div>

        {/* 生成ボタン */}
        <div className="flex-none p-4 border-t border-zinc-800">
          {tab === "narration" ? (
            <button
              onClick={generateNarration}
              disabled={submitting || !status?.irodori || !narrText.trim()}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 text-white font-bold text-sm disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90 transition"
            >
              <span className="inline-flex items-center gap-2">
                <Voice size={16} />
                {submitting ? "生成中…" : "ナレーションを作る"}
              </span>
            </button>
          ) : tab === "compose" ? (
            <button
              onClick={generateCompose}
              disabled={submitting || !status?.comfy.ok || !status?.models.ace15}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 text-white font-bold text-sm disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90 transition"
            >
              <span className="inline-flex items-center gap-2">
                <Spark size={16} />
                {submitting ? "生成キューに追加中…" : "構成から曲を作る"}
              </span>
            </button>
          ) : (
            <button
              onClick={generate}
              disabled={submitting || !status?.comfy.ok || !modelReady}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 text-white font-bold text-sm disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90 transition"
            >
              <span className="inline-flex items-center gap-2">
                <Spark size={16} />
                {submitting ? "生成キューに追加中…" : "曲を作る"}
              </span>
            </button>
          )}
          {tab === "narration" && !status?.irodori && (
            <p className="text-[11px] text-amber-400 mt-1.5 text-center">
              Irodori-TTS が未起動です（`npm run irodori`）
            </p>
          )}
          {tab !== "narration" && !status?.comfy.ok && (
            <p className="text-[11px] text-red-400 mt-1.5 text-center">
              ComfyUI に接続できません（起動してください）
            </p>
          )}
          {tab !== "narration" && status?.comfy.ok && !modelReady && (
            <p className="text-[11px] text-amber-400 mt-1.5 text-center">
              {effectiveEngine === "ace15"
                ? "ACE-Step 1.5"
                : effectiveEngine === "ace"
                ? "ACE-Step v1"
                : "Stable Audio"}{" "}
              モデルが未導入です
            </p>
          )}
          {message && (
            <p className="text-[11px] text-zinc-400 mt-1.5 text-center">{message}</p>
          )}
        </div>
      </aside>

      {/* 右：ライブラリ */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* ヘッダー */}
        <header className="flex-none px-6 py-3 border-b border-zinc-800 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3 mb-0.5">
              <button
                onClick={() => setView("library")}
                className={`text-lg font-bold inline-flex items-center gap-1.5 ${
                  view === "library" ? "text-zinc-100" : "text-zinc-600 hover:text-zinc-400"
                }`}
              >
                <Library size={17} /> ライブラリ
              </button>
              <button
                onClick={() => setView("albums")}
                className={`text-lg font-bold inline-flex items-center gap-1.5 ${
                  view === "albums" ? "text-zinc-100" : "text-zinc-600 hover:text-zinc-400"
                }`}
              >
                <Disc size={17} /> アルバム
              </button>
            </div>
            <p className="text-xs text-zinc-500">
              {status?.comfy.ok ? (
                <>
                  ● ComfyUI 接続中
                  {status.comfy.gpu &&
                    ` ・ ${status.comfy.gpu.replace("cuda:0 ", "")} ・ VRAM ${status.comfy.vramFreeGB?.toFixed(
                      1
                    )}GB空き`}
                </>
              ) : (
                <span className="text-red-400">● ComfyUI 未接続</span>
              )}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {completed.length > 0 && (
              <button
                onClick={() =>
                  completed.forEach((j) => {
                    const a = document.createElement("a");
                    a.href = j.audioUrl!;
                    a.download = j.filename || "track.mp3";
                    document.body.appendChild(a);
                    a.click();
                    a.remove();
                  })
                }
                className="text-xs px-3 py-1.5 rounded-lg bg-zinc-800 text-zinc-200 hover:bg-zinc-700"
              >
                すべてDL（{completed.length}）
              </button>
            )}
            <button
              onClick={() => setScheduleOpen((v) => !v)}
              className="text-xs px-3 py-1.5 rounded-lg bg-zinc-800 text-zinc-200 hover:bg-zinc-700"
            >
              自動生成
            </button>
            <Link
              href="/help"
              className="text-xs px-3 py-1.5 rounded-lg bg-zinc-800 text-zinc-200 hover:bg-zinc-700"
            >
              ヘルプ
            </Link>
          </div>
        </header>

        {view === "library" && (
        <>
        {/* 自動生成パネル */}
        {scheduleOpen && schedule && (
          <div className="flex-none px-6 py-4 border-b border-zinc-800 bg-zinc-900/40">
            <div className="flex flex-wrap items-end gap-3">
              <div>
                <label className="block text-[11px] text-zinc-500 mb-1">ジャンル</label>
                <select
                  value={schedule.presetId}
                  onChange={(e) => saveSchedule({ presetId: e.target.value })}
                  className="rounded-lg bg-zinc-900 border border-zinc-800 px-2 py-1.5 text-sm"
                >
                  {PRESETS.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[11px] text-zinc-500 mb-1">曲数/日</label>
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={schedule.count}
                  onChange={(e) => saveSchedule({ count: Number(e.target.value) })}
                  className="w-16 rounded-lg bg-zinc-900 border border-zinc-800 px-2 py-1.5 text-sm"
                />
              </div>
              <div>
                <label className="block text-[11px] text-zinc-500 mb-1">時刻</label>
                <input
                  type="time"
                  value={schedule.time}
                  onChange={(e) => saveSchedule({ time: e.target.value })}
                  className="rounded-lg bg-zinc-900 border border-zinc-800 px-2 py-1.5 text-sm"
                />
              </div>
              <button
                onClick={() => saveSchedule({ enabled: !schedule.enabled })}
                className={`px-3 py-1.5 rounded-lg text-sm font-semibold ${
                  schedule.enabled
                    ? "bg-zinc-700 text-zinc-200"
                    : "bg-orange-600 text-white"
                }`}
              >
                {schedule.enabled ? `ON (${schedule.time}) — 止める` : "ONにする"}
              </button>
              <span className="text-[11px] text-zinc-500">
                常駐: <code className="bg-zinc-800 px-1 rounded">npm run scheduler</code>
              </span>
            </div>
          </div>
        )}

        {/* フィード */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {jobs.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-zinc-600">
              <Wave size={44} className="mb-3 text-zinc-700" />
              <p className="text-sm">
                まだ曲がありません。左のパネルから最初の1曲を作ってみよう。
              </p>
            </div>
          ) : (
            <ul className="space-y-2 max-w-3xl">
              {jobs.map((j) => (
                <li
                  key={j.id}
                  className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-3 flex items-center gap-3 hover:border-zinc-700 transition"
                >
                  {/* カバー */}
                  <div
                    className={`w-14 h-14 flex-none rounded-lg flex items-center justify-center text-2xl ${
                      j.status === "COMPLETED"
                        ? "bg-gradient-to-br from-orange-500/25 to-amber-500/25"
                        : "bg-zinc-800"
                    }`}
                  >
                    {j.status === "RUNNING" || j.status === "QUEUED" ? (
                      <span className="w-5 h-5 border-2 border-zinc-600 border-t-orange-400 rounded-full animate-spin" />
                    ) : j.engine === "tts" ? (
                      <Voice size={22} className="text-orange-300" />
                    ) : j.hasVocals ? (
                      <Mic size={22} className="text-orange-300" />
                    ) : (
                      <Note size={22} className="text-orange-300" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      {j.audioUrl ? (
                        <Link
                          href={`/editor/${j.id}`}
                          className="font-semibold text-sm truncate hover:text-[var(--accent-2)]"
                          title="クリックで編集画面を開く"
                        >
                          {j.title}
                        </Link>
                      ) : (
                        <span className="font-semibold text-sm truncate">{j.title}</span>
                      )}
                      <span
                        className={`text-[10px] px-1.5 py-0.5 rounded ${statusBadge[j.status]}`}
                      >
                        {statusLabel[j.status]}
                      </span>
                      {j.reference && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-orange-500/20 text-orange-300">
                          声寄せ
                        </span>
                      )}
                      {j.auto && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-700 text-zinc-300">
                          自動
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-zinc-500 truncate">
                      {j.engine === "ace15"
                        ? "ACE-Step 1.5"
                        : j.engine === "ace"
                        ? "ACE-Step v1"
                        : j.engine === "sao"
                        ? "Stable Audio"
                        : "ナレーション"}{" "}
                      ・ {j.seconds}秒 ・{" "}
                      {fmtTime(j.createdAt)} ・ {j.tags.slice(0, 60)}
                    </p>
                    {j.audioUrl ? (
                      <>
                        <audio controls src={j.audioUrl} className="w-full h-8 mt-1.5" />

                        {/* 作り直し（変奏） */}
                        {remakeOpen[j.id] && (
                          <div className="mt-1.5 rounded-lg bg-zinc-900/70 border border-zinc-800 p-2.5">
                            <p className="text-[11px] text-zinc-400 mb-2">
                              ✨ この曲を種に作り直します（原曲の雰囲気を残しつつ変化）
                            </p>
                            <div className="flex items-center gap-2 mb-2">
                              <span className="text-[11px] text-zinc-400 w-20 flex-none">
                                変化の強さ
                              </span>
                              <input
                                type="range"
                                min={0.2}
                                max={0.9}
                                step={0.05}
                                value={remakeDenoise[j.id] ?? 0.6}
                                onChange={(e) =>
                                  setRemakeDenoise((m) => ({
                                    ...m,
                                    [j.id]: Number(e.target.value),
                                  }))
                                }
                                className="flex-1"
                              />
                              <span className="text-[10px] font-mono text-zinc-400 w-16 text-right">
                                {((remakeDenoise[j.id] ?? 0.6) < 0.45
                                  ? "原曲寄り"
                                  : (remakeDenoise[j.id] ?? 0.6) > 0.7
                                  ? "大胆"
                                  : "ほどよく")}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => runRemake(j.id)}
                                disabled={remaking[j.id]}
                                className="text-xs px-3 py-1.5 rounded-lg bg-gradient-to-r from-orange-500 to-amber-500 text-white font-semibold disabled:opacity-50"
                              >
                                {remaking[j.id] ? "作成中…" : "作り直す"}
                              </button>
                              <button
                                onClick={() =>
                                  setRemakeOpen((m) => ({ ...m, [j.id]: false }))
                                }
                                className="text-xs text-zinc-500 hover:text-zinc-300"
                              >
                                閉じる
                              </button>
                            </div>
                          </div>
                        )}

                        {/* マスタリング */}
                        {j.masteredUrl && (
                          <div className="mt-1.5 rounded-lg bg-emerald-500/5 border border-emerald-500/20 p-2">
                            <div className="flex items-center justify-between mb-1">
                              <p className="text-[11px] text-emerald-300">
                                仕上げ済み（48kHz/24bit WAV
                                {j.masteredLufs ? ` ・ 目標${j.masteredLufs} LUFS` : ""}）
                              </p>
                              <button
                                onClick={() =>
                                  setMasterOpen((m) => ({ ...m, [j.id]: true }))
                                }
                                className="text-[10px] text-zinc-400 hover:text-zinc-200 whitespace-nowrap"
                              >
                                🔁 別の仕上げを試す
                              </button>
                            </div>
                            <audio controls src={j.masteredUrl} className="w-full h-8" />
                          </div>
                        )}
                        {masterOpen[j.id] && (
                          <div className="mt-2 rounded-lg bg-zinc-900/70 border border-zinc-800 p-2.5">
                            <p className="text-[11px] text-zinc-400 mb-2">
                              仕上げ方を選ぶ（マスタリング）
                            </p>
                            {/* プリセットカード */}
                            <div className="grid grid-cols-2 gap-1.5 mb-2">
                              {MASTER_PRESET_META.map((p) => {
                                const sel = (masterPreset[j.id] || "natural") === p.id;
                                return (
                                  <button
                                    key={p.id}
                                    onClick={() => pickMaster(j.id, p.id)}
                                    className={`text-left rounded-lg border p-2 transition ${
                                      sel
                                        ? "bg-emerald-500/10 border-emerald-500"
                                        : "bg-zinc-950 border-zinc-800 hover:border-zinc-600"
                                    }`}
                                  >
                                    <div className="text-xs font-semibold text-zinc-100">
                                      {p.label}
                                    </div>
                                    <div className="text-[10px] text-zinc-500 mb-1.5 leading-tight">
                                      {p.tagline}
                                    </div>
                                    {/* メーター */}
                                    <div className="space-y-0.5">
                                      {MASTER_METERS.map((m) => {
                                        const v = (p.meters as any)[m.key] as number;
                                        return (
                                          <div
                                            key={m.key}
                                            className="flex items-center gap-1"
                                          >
                                            <span className="w-8 text-[9px] text-zinc-500 flex-none">
                                              {m.label}
                                            </span>
                                            <span className="flex gap-0.5">
                                              {[0, 1, 2].map((i) => (
                                                <span
                                                  key={i}
                                                  className={`w-2 h-1.5 rounded-sm ${
                                                    i < v
                                                      ? "bg-emerald-400"
                                                      : "bg-zinc-700"
                                                  }`}
                                                />
                                              ))}
                                            </span>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </button>
                                );
                              })}
                              {/* カスタム */}
                              <button
                                onClick={() => pickMaster(j.id, "custom")}
                                className={`text-left rounded-lg border p-2 transition ${
                                  masterPreset[j.id] === "custom"
                                    ? "bg-emerald-500/10 border-emerald-500"
                                    : "bg-zinc-950 border-zinc-800 hover:border-zinc-600"
                                }`}
                              >
                                <div className="text-xs font-semibold text-zinc-100">
                                  カスタム
                                </div>
                                <div className="text-[10px] text-zinc-500 leading-tight">
                                  スライダーで自分好みに手動調整
                                </div>
                              </button>
                            </div>

                            {/* 選択中プリセットの「こうなる」 */}
                            {masterPreset[j.id] !== "custom" && (
                              <p className="text-[10px] text-emerald-300/80 mb-2 leading-relaxed">
                                {
                                  MASTER_PRESET_META.find(
                                    (p) => p.id === (masterPreset[j.id] || "natural")
                                  )?.result
                                }
                              </p>
                            )}

                            {/* カスタムスライダー */}
                            {masterPreset[j.id] === "custom" && (
                              <div className="space-y-1.5 mb-2">
                                {MASTER_SLIDERS.map((s) => {
                                  const cur =
                                    masterSettings[j.id]?.[s.key] ?? s.default;
                                  return (
                                    <div key={s.key}>
                                      <div className="flex items-center gap-2">
                                        <span className="w-24 text-[11px] text-zinc-300 flex-none">
                                          {s.label}
                                        </span>
                                        <input
                                          type="range"
                                          min={s.min}
                                          max={s.max}
                                          step={s.step}
                                          value={cur}
                                          onChange={(e) =>
                                            setCustom(j.id, s.key, Number(e.target.value))
                                          }
                                          className="flex-1"
                                        />
                                        <span className="w-10 text-right text-[10px] text-zinc-400">
                                          {cur}
                                        </span>
                                      </div>
                                      <p className="text-[9px] text-zinc-600 ml-24 -mt-0.5">
                                        {s.hint}
                                      </p>
                                    </div>
                                  );
                                })}
                              </div>
                            )}

                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => runMaster(j.id)}
                                disabled={mastering[j.id]}
                                className="text-xs px-3 py-1.5 rounded-lg bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-semibold disabled:opacity-50"
                              >
                                {mastering[j.id] ? "処理中…" : "この設定で仕上げる"}
                              </button>
                              <button
                                onClick={() =>
                                  setMasterOpen((m) => ({ ...m, [j.id]: false }))
                                }
                                className="text-xs text-zinc-500 hover:text-zinc-300"
                              >
                                閉じる
                              </button>
                            </div>
                          </div>
                        )}

                        {/* リミックス結果 */}
                        {j.remixUrl && (
                          <div className="mt-1.5 rounded-lg bg-sky-500/5 border border-sky-500/20 p-2">
                            <div className="flex items-center justify-between mb-1">
                              <p className="text-[11px] text-sky-300">
                                編集後リミックス
                              </p>
                              <button
                                onClick={() =>
                                  setStemOpen((m) => ({ ...m, [j.id]: true }))
                                }
                                className="text-[10px] text-zinc-400 hover:text-zinc-200"
                              >
                                再編集
                              </button>
                            </div>
                            <audio controls src={j.remixUrl} className="w-full h-8" />
                          </div>
                        )}

                        {/* ステム編集パネル */}
                        {stemOpen[j.id] && (
                          <div className="mt-2 rounded-lg bg-zinc-900/70 border border-zinc-800 p-2.5">
                            {!j.stems ? (
                              <div>
                                <p className="text-[11px] text-zinc-400 mb-2 leading-relaxed">
                                  曲を6パート（歌/ドラム/ベース/ギター/ピアノ/その他）に分解して、
                                  各パートの音量を個別に調整できます。
                                </p>
                                <button
                                  onClick={() => runSeparate(j.id)}
                                  disabled={separating[j.id]}
                                  className="text-xs px-3 py-1.5 rounded-lg bg-gradient-to-r from-sky-500 to-indigo-500 text-white font-semibold disabled:opacity-50"
                                >
                                  {separating[j.id]
                                    ? "分解中…（数十秒〜数分）"
                                    : "ステム分解する"}
                                </button>
                                <button
                                  onClick={() =>
                                    setStemOpen((m) => ({ ...m, [j.id]: false }))
                                  }
                                  className="ml-2 text-xs text-zinc-500 hover:text-zinc-300"
                                >
                                  閉じる
                                </button>
                              </div>
                            ) : (
                              <div>
                                <p className="text-[11px] text-zinc-400 mb-2">
                                  パート編集（各パートの音量・ミュート）
                                </p>
                                <div className="space-y-1.5 mb-2">
                                  {STEMS.map((s) => {
                                    const g = gains[j.id]?.[s.id] ?? 0;
                                    const muted = mutes[j.id]?.[s.id];
                                    const url = j.stems?.[s.id];
                                    if (!url) return null;
                                    return (
                                      <div
                                        key={s.id}
                                        className="flex items-center gap-2"
                                      >
                                        <button
                                          onClick={() => toggleMute(j.id, s.id)}
                                          className={`w-16 text-left text-[11px] flex-none ${
                                            muted
                                              ? "text-zinc-600 line-through"
                                              : "text-zinc-200"
                                          }`}
                                        >
                                          {s.label}
                                        </button>
                                        <input
                                          type="range"
                                          min={-30}
                                          max={6}
                                          step={1}
                                          value={g}
                                          disabled={muted}
                                          onChange={(e) =>
                                            setGain(j.id, s.id, Number(e.target.value))
                                          }
                                          className="flex-1 disabled:opacity-30"
                                        />
                                        <span className="w-10 text-right text-[10px] text-zinc-400">
                                          {muted ? "OFF" : `${g > 0 ? "+" : ""}${g}dB`}
                                        </span>
                                        <audio
                                          controls
                                          src={url}
                                          className="h-6 w-28 flex-none"
                                        />
                                      </div>
                                    );
                                  })}
                                </div>
                                <div className="flex flex-wrap items-center gap-3 mb-2">
                                  <label className="flex items-center gap-1.5 text-[11px] text-zinc-300">
                                    <input
                                      type="checkbox"
                                      checked={!!vocalClean[j.id]}
                                      onChange={(e) =>
                                        setVocalClean((m) => ({
                                          ...m,
                                          [j.id]: e.target.checked,
                                        }))
                                      }
                                      className="accent-sky-500"
                                    />
                                    歌声クリーンアップ（反響/ノイズ低減）
                                  </label>
                                  <label className="flex items-center gap-1.5 text-[11px] text-zinc-300">
                                    末尾フェードアウト
                                    <input
                                      type="number"
                                      min={0}
                                      max={20}
                                      value={fadeOut[j.id] ?? 0}
                                      onChange={(e) =>
                                        setFadeOut((m) => ({
                                          ...m,
                                          [j.id]: Number(e.target.value),
                                        }))
                                      }
                                      className="w-14 rounded bg-zinc-900 border border-zinc-800 px-1.5 py-0.5 text-xs"
                                    />
                                    秒
                                  </label>
                                </div>
                                <div className="flex items-center gap-2">
                                  <button
                                    onClick={() => runRemix(j.id, j.stemsId!)}
                                    disabled={remixing[j.id]}
                                    className="text-xs px-3 py-1.5 rounded-lg bg-gradient-to-r from-sky-500 to-indigo-500 text-white font-semibold disabled:opacity-50"
                                  >
                                    {remixing[j.id]
                                      ? "書き出し中…"
                                      : "この設定でリミックス書き出し"}
                                  </button>
                                  <button
                                    onClick={() =>
                                      setStemOpen((m) => ({ ...m, [j.id]: false }))
                                    }
                                    className="text-xs text-zinc-500 hover:text-zinc-300"
                                  >
                                    閉じる
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </>
                    ) : j.status === "FAILED" ? (
                      <p className="text-[11px] text-red-400 mt-1 truncate">
                        {j.error || "生成に失敗しました"}
                      </p>
                    ) : null}
                  </div>

                  {j.audioUrl && (
                    <div className="flex-none flex flex-col gap-1">
                      <Link
                        href={`/editor/${j.id}`}
                        className="text-xs px-3 py-2 rounded-lg bg-[var(--accent)] text-black font-semibold hover:opacity-90 whitespace-nowrap inline-flex items-center gap-1.5 justify-center"
                        title="マルチトラック編集（別画面・楽器ごとに調整）"
                      >
                        <Sliders size={13} /> 編集
                      </Link>
                      {!j.masteredUrl && !masterOpen[j.id] && (
                        <button
                          onClick={() => setMasterOpen((m) => ({ ...m, [j.id]: true }))}
                          className="text-xs px-3 py-2 rounded-lg bg-zinc-800 text-zinc-200 hover:bg-zinc-700 whitespace-nowrap inline-flex items-center gap-1.5"
                          title="Lusterでマスタリング"
                        >
                          <Gauge size={13} /> 仕上げ
                        </button>
                      )}
                      {!stemOpen[j.id] && (
                        <button
                          onClick={() => setStemOpen((m) => ({ ...m, [j.id]: true }))}
                          className="text-xs px-3 py-2 rounded-lg bg-zinc-800 text-zinc-200 hover:bg-zinc-700 whitespace-nowrap inline-flex items-center gap-1.5"
                          title="ステム分解して各パートを編集"
                        >
                          <Layers size={13} /> 分解
                        </button>
                      )}
                      {j.engine !== "tts" && !remakeOpen[j.id] && (
                        <button
                          onClick={() => setRemakeOpen((m) => ({ ...m, [j.id]: true }))}
                          className="text-xs px-3 py-2 rounded-lg bg-zinc-800 text-zinc-200 hover:bg-zinc-700 whitespace-nowrap inline-flex items-center gap-1.5"
                          title="この曲を種に作り直す（変奏）"
                        >
                          <Spark size={13} /> 作り直す
                        </button>
                      )}
                      <a
                        href={j.masteredUrl || j.audioUrl}
                        download={
                          j.masteredUrl
                            ? j.masteredFilename || "master.wav"
                            : j.filename || "track.mp3"
                        }
                        className="text-xs px-3 py-2 rounded-lg bg-zinc-800 text-zinc-200 hover:bg-zinc-700 text-center inline-flex items-center gap-1.5 justify-center"
                      >
                        <Download size={13} /> DL{j.masteredUrl ? " WAV" : ""}
                      </a>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
        </>
        )}

        {/* アルバム管理 */}
        {view === "albums" && (
          <div className="flex-1 overflow-y-auto px-6 py-4">
            {/* 新規作成 */}
            <div className="flex items-center gap-2 mb-4 max-w-3xl">
              <input
                value={newAlbumTitle}
                onChange={(e) => setNewAlbumTitle(e.target.value)}
                placeholder="新しいアルバム名"
                className="flex-1 rounded-lg bg-zinc-900 border border-zinc-800 px-3 py-2 text-sm"
              />
              <button
                onClick={createAlbumH}
                className="px-4 py-2 rounded-lg bg-orange-600 text-white text-sm font-semibold"
              >
                ＋ アルバム作成
              </button>
            </div>

            {albums.length === 0 ? (
              <p className="text-sm text-zinc-500 py-8 text-center">
                まだアルバムがありません。上から作成してください。
              </p>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6 max-w-3xl">
                {albums.map((al) => (
                  <button
                    key={al.id}
                    onClick={() => setSelAlbum(al.id === selAlbum ? null : al.id)}
                    className={`text-left rounded-xl border p-2 transition ${
                      selAlbum === al.id
                        ? "border-orange-500 bg-orange-500/10"
                        : "border-zinc-800 bg-zinc-900/50 hover:border-zinc-600"
                    }`}
                  >
                    <div className="aspect-square rounded-lg overflow-hidden bg-gradient-to-br from-orange-500/25 to-amber-500/25 mb-2 flex items-center justify-center">
                      {al.coverUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={al.coverUrl}
                          alt={al.title}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <Disc size={26} className="text-orange-300/70" />
                      )}
                    </div>
                    <div className="text-sm font-semibold truncate">{al.title}</div>
                    <div className="text-[11px] text-zinc-500">
                      {al.trackIds.length}曲
                    </div>
                  </button>
                ))}
              </div>
            )}

            {/* 選択中アルバムの編集 */}
            {selAlbum &&
              (() => {
                const al = albums.find((a) => a.id === selAlbum);
                if (!al) return null;
                const memberSet = new Set(al.trackIds);
                const available = jobs.filter(
                  (j) => j.status === "COMPLETED" && j.audioUrl && !memberSet.has(j.id)
                );
                return (
                  <div className="max-w-3xl rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
                    <div className="flex items-start gap-4 mb-4">
                      {/* カバー */}
                      <div>
                        <div className="w-28 h-28 rounded-lg overflow-hidden bg-gradient-to-br from-orange-500/25 to-amber-500/25 flex items-center justify-center mb-1">
                          {al.coverUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={al.coverUrl}
                              alt={al.title}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <Disc size={34} className="text-orange-300/70" />
                          )}
                        </div>
                        <input
                          ref={coverFileRef}
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (f) uploadCover(al.id, f);
                          }}
                        />
                        <button
                          onClick={() => coverFileRef.current?.click()}
                          disabled={coverUploading}
                          className="text-[11px] text-zinc-400 hover:text-zinc-200 w-full text-center"
                        >
                          {coverUploading ? "アップ中…" : "🖼️ カバー変更"}
                        </button>
                      </div>
                      {/* タイトル等 */}
                      <div className="flex-1">
                        <input
                          value={al.title}
                          onChange={(e) => patchAlbum(al.id, { title: e.target.value })}
                          className="w-full rounded-lg bg-zinc-900 border border-zinc-800 px-3 py-2 text-sm font-semibold mb-2"
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={() => exportAlbum(al.id)}
                            className="text-xs px-3 py-1.5 rounded-lg bg-emerald-600 text-white font-semibold"
                          >
                            📁 フォルダ書き出し
                          </button>
                          <button
                            onClick={() => deleteAlbumH(al.id)}
                            className="text-xs px-3 py-1.5 rounded-lg bg-zinc-800 text-red-300 hover:bg-zinc-700"
                          >
                            🗑 削除
                          </button>
                        </div>
                        {exportMsg && (
                          <p className="text-[11px] text-zinc-400 mt-2 break-all">
                            {exportMsg}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* 収録曲 */}
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-2">
                      収録曲（{al.trackIds.length}）
                    </h3>
                    {al.trackIds.length === 0 ? (
                      <p className="text-[11px] text-zinc-500 mb-3">
                        下の「曲を追加」から入れてください。
                      </p>
                    ) : (
                      <ul className="space-y-1.5 mb-4">
                        {al.trackIds.map((tid, idx) => {
                          const job = jobs.find((j) => j.id === tid);
                          return (
                            <li
                              key={tid}
                              className="flex items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-900/50 p-2"
                            >
                              <span className="w-6 text-center text-xs text-zinc-500">
                                {idx + 1}
                              </span>
                              <span className="flex-1 text-sm truncate">
                                {job?.title || tid}
                              </span>
                              {job?.masteredUrl && (
                                <span className="text-[10px] text-emerald-400">仕上済</span>
                              )}
                              <button
                                onClick={() => albumMove(al, idx, -1)}
                                className="text-xs text-zinc-500 hover:text-zinc-200"
                              >
                                ↑
                              </button>
                              <button
                                onClick={() => albumMove(al, idx, 1)}
                                className="text-xs text-zinc-500 hover:text-zinc-200"
                              >
                                ↓
                              </button>
                              <button
                                onClick={() => albumRemoveTrack(al, tid)}
                                className="text-xs text-red-300 hover:text-red-200"
                              >
                                削除
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    )}

                    {/* 曲を追加 */}
                    <details>
                      <summary className="text-xs text-orange-400 cursor-pointer">
                        ＋ 曲を追加（ライブラリから）
                      </summary>
                      <div className="mt-2 space-y-1 max-h-48 overflow-y-auto">
                        {available.length === 0 ? (
                          <p className="text-[11px] text-zinc-500">追加できる曲がありません。</p>
                        ) : (
                          available.map((j) => (
                            <button
                              key={j.id}
                              onClick={() => albumAddTrack(al, j.id)}
                              className="w-full text-left text-xs px-2 py-1.5 rounded bg-zinc-900 border border-zinc-800 hover:border-orange-500 truncate"
                            >
                              ＋ {j.title}
                            </button>
                          ))
                        )}
                      </div>
                    </details>
                  </div>
                );
              })()}
          </div>
        )}
      </main>
    </div>
  );
}
