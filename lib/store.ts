// ジョブ台帳とスケジュール設定を、DATA_DIR配下のJSONファイルで保持する簡易ストア。
// （dev/single-processでの利用を想定。本番でスケールさせるならDBへ）
import fs from "node:fs";
import path from "node:path";
import type { Engine } from "./presets";

const DATA_DIR = process.env.DATA_DIR
  ? path.resolve(process.env.DATA_DIR)
  : path.resolve(process.cwd(), "data");
const JOBS_FILE = path.join(DATA_DIR, "jobs.json");
const SCHEDULE_FILE = path.join(DATA_DIR, "schedule.json");
const ALBUMS_FILE = path.join(DATA_DIR, "albums.json");

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

export type JobStatus = "QUEUED" | "RUNNING" | "COMPLETED" | "FAILED";

export interface Job {
  id: string; // ComfyUI prompt_id もしくは内部ID(tts_...)
  status: JobStatus;
  engine: Engine | "tts";
  presetId: string;
  title: string;
  tags: string;
  lyrics: string;
  seconds: number;
  seed: number;
  createdAt: number;
  updatedAt: number;
  audioUrl?: string; // /api/music-studio/audio/... の相対URL
  filename?: string;
  error?: string;
  auto?: boolean; // 自動生成由来か
  hasVocals?: boolean; // 歌入りか
  reference?: boolean; // 参照音声（声寄せ）を使ったか
  // マスタリング（Luster）
  masteredUrl?: string; // 仕上げWAVの配信URL
  masteredFilename?: string;
  masteredLufs?: number; // 仕上げ後の目標LUFS
  masterPreset?: string; // 使ったプリセット名
  // ステム分離（Demucs）＆編集
  stemsId?: string; // 分離結果の識別子（=元ファイル名のstem）
  stems?: Record<string, string>; // ステム名 -> 配信URL
  remixUrl?: string; // 編集後リミックスの配信URL
  remixFilename?: string;
  // 波形/スペクトログラム編集の書き出し
  editedUrl?: string;
  editedFilename?: string;
}

function readJobs(): Job[] {
  ensureDir();
  if (!fs.existsSync(JOBS_FILE)) return [];
  try {
    return JSON.parse(fs.readFileSync(JOBS_FILE, "utf-8")) as Job[];
  } catch {
    return [];
  }
}

function writeJobs(jobs: Job[]) {
  ensureDir();
  fs.writeFileSync(JOBS_FILE, JSON.stringify(jobs, null, 2), "utf-8");
}

export function addJob(job: Job) {
  const jobs = readJobs();
  jobs.unshift(job);
  writeJobs(jobs);
}

export function updateJob(id: string, patch: Partial<Job>) {
  const jobs = readJobs();
  const i = jobs.findIndex((j) => j.id === id);
  if (i >= 0) {
    jobs[i] = { ...jobs[i], ...patch, updatedAt: Date.now() };
    writeJobs(jobs);
    return jobs[i];
  }
  return null;
}

export function listJobs(): Job[] {
  return readJobs();
}

export function getJob(id: string): Job | null {
  return readJobs().find((j) => j.id === id) ?? null;
}

// ---- スケジュール（毎日の自動生成）----
export interface Schedule {
  enabled: boolean;
  presetId: string;
  count: number; // 1回の実行で作る曲数
  tags: string; // 空ならプリセットのまま
  time: string; // "HH:MM"（scripts/scheduler.mjs が参照）
  lastRunDate?: string; // "YYYY-MM-DD"（多重実行防止）
}

export const DEFAULT_SCHEDULE: Schedule = {
  enabled: false,
  presetId: "lofi",
  count: 3,
  tags: "",
  time: "03:00",
};

export function getSchedule(): Schedule {
  ensureDir();
  if (!fs.existsSync(SCHEDULE_FILE)) return { ...DEFAULT_SCHEDULE };
  try {
    return { ...DEFAULT_SCHEDULE, ...JSON.parse(fs.readFileSync(SCHEDULE_FILE, "utf-8")) };
  } catch {
    return { ...DEFAULT_SCHEDULE };
  }
}

export function setSchedule(patch: Partial<Schedule>): Schedule {
  const cur = getSchedule();
  const next = { ...cur, ...patch };
  ensureDir();
  fs.writeFileSync(SCHEDULE_FILE, JSON.stringify(next, null, 2), "utf-8");
  return next;
}

// ---- アルバム管理 ----
export interface Album {
  id: string;
  title: string;
  coverUrl?: string; // 配信URL
  coverFilename?: string;
  trackIds: string[]; // Job.id の並び順
  createdAt: number;
  updatedAt: number;
}

function readAlbums(): Album[] {
  ensureDir();
  if (!fs.existsSync(ALBUMS_FILE)) return [];
  try {
    return JSON.parse(fs.readFileSync(ALBUMS_FILE, "utf-8")) as Album[];
  } catch {
    return [];
  }
}
function writeAlbums(albums: Album[]) {
  ensureDir();
  fs.writeFileSync(ALBUMS_FILE, JSON.stringify(albums, null, 2), "utf-8");
}

export function listAlbums(): Album[] {
  return readAlbums();
}
export function getAlbum(id: string): Album | null {
  return readAlbums().find((a) => a.id === id) ?? null;
}
export function createAlbum(title: string): Album {
  const albums = readAlbums();
  const now = Date.now();
  const album: Album = {
    id: `alb_${now}`,
    title: title || "無題のアルバム",
    trackIds: [],
    createdAt: now,
    updatedAt: now,
  };
  albums.unshift(album);
  writeAlbums(albums);
  return album;
}
export function updateAlbum(id: string, patch: Partial<Album>): Album | null {
  const albums = readAlbums();
  const i = albums.findIndex((a) => a.id === id);
  if (i < 0) return null;
  albums[i] = { ...albums[i], ...patch, updatedAt: Date.now() };
  writeAlbums(albums);
  return albums[i];
}
export function deleteAlbum(id: string) {
  writeAlbums(readAlbums().filter((a) => a.id !== id));
}
