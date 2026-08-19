"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  Logo,
  Spark,
  Sliders,
  Disc,
  Chip,
  Play,
  Note,
  Mic,
  Voice,
} from "@/components/icons";

interface Status {
  comfy: { ok: boolean; gpu?: string; vramFreeGB?: number };
  models: { ace: boolean; ace15?: boolean; sao: boolean };
  irodori?: boolean;
}
interface Job {
  id: string;
  title: string;
  engine: string;
  status: string;
  audioUrl?: string;
  hasVocals?: boolean;
}

function Pill({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border ${
        ok
          ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
          : "border-zinc-700 bg-zinc-800/50 text-zinc-500"
      }`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${ok ? "bg-emerald-400" : "bg-zinc-600"}`} />
      {label}
    </span>
  );
}

export default function Landing() {
  const [status, setStatus] = useState<Status | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);

  useEffect(() => {
    fetch("/api/music-studio/status", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then(setStatus)
      .catch(() => {});
    fetch("/api/music-studio/jobs?limit=6", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setJobs(d.jobs))
      .catch(() => {});
  }, []);

  const done = jobs.filter((j) => j.status === "COMPLETED" && j.audioUrl);

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)]">
      {/* nav */}
      <nav className="border-b border-[var(--border)] px-6 py-3 flex items-center gap-3">
        <Logo size={24} />
        <span className="text-lg font-bold tracking-tight">
          FORGE<span className="text-[var(--accent)]">.</span>
        </span>
        <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400 font-mono ml-1">
          LOCAL STUDIO
        </span>
        <div className="ml-auto flex items-center gap-4 text-sm text-[var(--text-dim)]">
          <Link href="/music-studio" className="hover:text-[var(--text)]">スタジオ</Link>
          <Link href="/help" className="hover:text-[var(--text)]">ヘルプ</Link>
        </div>
      </nav>

      <div className="max-w-5xl mx-auto px-6">
        {/* hero */}
        <section className="pt-16 pb-10 text-center">
          <div className="inline-flex items-center gap-2 text-xs text-[var(--text-dim)] border border-[var(--border)] rounded-full px-3 py-1 mb-6">
            <Chip size={13} className="text-[var(--accent)]" />
            {status?.comfy.gpu
              ? status.comfy.gpu.replace("cuda:0 ", "")
              : "ローカルGPU"}{" "}
            で動作・無制限・完全オフライン
          </div>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight leading-tight mb-4">
            あなたのPCが、
            <br />
            <span className="bg-gradient-to-r from-[var(--accent)] to-amber-300 bg-clip-text text-transparent">
              音楽スタジオになる。
            </span>
          </h1>
          <p className="text-[var(--text-dim)] text-base max-w-xl mx-auto mb-8 leading-relaxed">
            生成 → 構成づくり → マルチトラック編集 → マスタリング → アルバム化まで、
            すべて自分のPCで。クラウド不要・上限なし。
          </p>
          <div className="flex items-center justify-center gap-3">
            <Link
              href="/music-studio"
              className="px-6 py-3 rounded-xl bg-[var(--accent)] text-black font-bold text-sm hover:opacity-90 inline-flex items-center gap-2"
            >
              <Spark size={16} /> 曲を作る
            </Link>
            <Link
              href="/help"
              className="px-6 py-3 rounded-xl border border-[var(--border)] text-[var(--text)] font-semibold text-sm hover:bg-[var(--surface)]"
            >
              使い方を見る
            </Link>
          </div>

          {/* status pills */}
          <div className="flex flex-wrap items-center justify-center gap-2 mt-8">
            <Pill ok={!!status?.comfy.ok} label={status?.comfy.ok ? "ComfyUI 接続中" : "ComfyUI 未接続"} />
            <Pill ok={!!status?.models.ace15} label="ACE-Step 1.5" />
            <Pill ok={!!status?.models.sao} label="Stable Audio" />
            <Pill ok={!!status?.irodori} label="Irodori-TTS" />
          </div>
        </section>

        {/* entry cards */}
        <section className="grid md:grid-cols-3 gap-4 pb-12">
          {[
            { href: "/music-studio", icon: <Spark size={22} />, title: "生成・作曲", desc: "かんたん/フルカスタム/構成から作曲/ナレーション" },
            { href: "/music-studio", icon: <Sliders size={22} />, title: "マルチトラック編集", desc: "楽器ごとに分解して音量・EQ・区間編集" },
            { href: "/music-studio", icon: <Disc size={22} />, title: "アルバム管理", desc: "カバー・曲順・フォルダ書き出し" },
          ].map((c, i) => (
            <Link
              key={i}
              href={c.href}
              className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 hover:border-[var(--accent)]/50 transition group"
            >
              <div className="w-11 h-11 rounded-xl bg-[var(--accent-soft)] text-[var(--accent)] flex items-center justify-center mb-3 group-hover:scale-105 transition">
                {c.icon}
              </div>
              <h3 className="font-semibold mb-1">{c.title}</h3>
              <p className="text-sm text-[var(--text-dim)] leading-relaxed">{c.desc}</p>
            </Link>
          ))}
        </section>

        {/* recent */}
        {done.length > 0 && (
          <section className="pb-16">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-[var(--text-dim)]">
                最近の曲
              </h2>
              <Link href="/music-studio" className="text-xs text-[var(--accent-2)] hover:underline">
                すべて見る →
              </Link>
            </div>
            <div className="grid sm:grid-cols-2 gap-2">
              {done.map((j) => (
                <Link
                  key={j.id}
                  href={`/editor/${j.id}`}
                  className="flex items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3 hover:border-[var(--accent)]/40"
                >
                  <div className="w-11 h-11 rounded-lg bg-gradient-to-br from-[var(--accent)]/25 to-amber-500/20 flex items-center justify-center text-[var(--accent-2)]">
                    {j.engine === "tts" ? <Voice size={18} /> : j.hasVocals ? <Mic size={18} /> : <Note size={18} />}
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">{j.title}</div>
                    <div className="text-[11px] text-[var(--text-dim)]">
                      {j.engine === "ace15" ? "ACE-Step 1.5" : j.engine === "tts" ? "ナレーション" : j.engine}
                    </div>
                  </div>
                  <Play size={16} className="ml-auto text-[var(--text-dim)]" />
                </Link>
              ))}
            </div>
          </section>
        )}
      </div>

      <footer className="border-t border-[var(--border)] px-6 py-5 text-center text-xs text-[var(--text-dim)]">
        FORGE · ローカル音楽制作スタジオ · ComfyUI + ACE-Step / Stable Audio / Irodori-TTS
      </footer>
    </div>
  );
}
