"use client";
// ブラウザから読み取れる範囲で、閲覧者のPC構成を表示する。
// VRAM と空きストレージはブラウザからは取得できないため、その旨を明記する。
import { useState } from "react";

type Badge = { kind: "ok" | "warn" | "na"; text: string };
type Row = { key: string; value: string; badge: Badge };

function detectGpu(): string | null {
  try {
    const c = document.createElement("canvas");
    const gl = (c.getContext("webgl") ||
      c.getContext("experimental-webgl")) as WebGLRenderingContext | null;
    if (!gl) return null;
    const ext = gl.getExtension("WEBGL_debug_renderer_info");
    if (ext) return gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) as string;
    return gl.getParameter(gl.RENDERER) as string;
  } catch {
    return null;
  }
}

function detectOs(): string {
  const nav = navigator as Navigator & { userAgentData?: { platform?: string } };
  if (nav.userAgentData?.platform) return nav.userAgentData.platform;
  const u = navigator.userAgent;
  if (/Windows NT 10/.test(u)) return "Windows 10 / 11";
  if (/Mac OS X/.test(u)) return "macOS";
  if (/Linux/.test(u)) return "Linux";
  return u.slice(0, 40);
}

export function PcCheck() {
  const [rows, setRows] = useState<Row[] | null>(null);

  const run = () => {
    const out: Row[] = [];

    const cores = navigator.hardwareConcurrency;
    out.push({
      key: "CPU",
      value: cores ? `${cores} 論理コア` : "取得できません",
      badge: cores
        ? cores >= 4
          ? { kind: "ok", text: "最低ライン OK" }
          : { kind: "warn", text: "4コア未満" }
        : { kind: "na", text: "不明" },
    });

    const mem = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;
    out.push({
      key: "メモリ",
      value: mem ? `${mem >= 8 ? "8GB 以上" : `${mem}GB`}（概算）` : "ブラウザからは取得できません",
      badge: mem
        ? mem >= 8
          ? { kind: "ok", text: "16GB あれば OK" }
          : { kind: "warn", text: "要確認" }
        : { kind: "na", text: "手動確認" },
    });

    const gpu = detectGpu();
    const dedicated = !!gpu && /(nvidia|geforce|rtx|gtx|radeon|rx |arc )/i.test(gpu);
    out.push({
      key: "GPU",
      value: gpu || "取得できません",
      badge: gpu
        ? dedicated
          ? { kind: "ok", text: "専用GPU 検出" }
          : { kind: "warn", text: "VRAM 要確認" }
        : { kind: "na", text: "不明" },
    });

    out.push({ key: "OS", value: detectOs(), badge: { kind: "na", text: "—" } });

    setRows(out);
  };

  return (
    <div className="pccheck">
      <div className="pccheck-head">
        <div>
          <p className="eyebrow">セルフチェック</p>
          <h3>いま見ているPCを確認する</h3>
          <p>
            ブラウザから分かる範囲で、あなたのPC構成を表示します。インストールは不要で、
            データはどこにも送信されません（すべてこのページ内で完結します）。
          </p>
        </div>
        <button className="btn btn-ghost" onClick={run} style={{ padding: "11px 20px", fontSize: 14 }}>
          {rows ? "再チェック" : "▶ チェックする"}
        </button>
      </div>

      {rows && (
        <>
          <div className="pc-grid">
            {rows.map((r) => (
              <div className="pc-row" key={r.key}>
                <span className="pc-k">{r.key}</span>
                <span className="pc-v">{r.value}</span>
                <span className={`pc-badge ${r.badge.kind}`}>{r.badge.text}</span>
              </div>
            ))}
          </div>
          <p className="pc-foot">
            これはブラウザが取得できる概算値です。
            <b style={{ color: "var(--text-dim)" }}>
              VRAM（GPUメモリ）と空きストレージはブラウザからは読み取れません
            </b>
            。GPU名から目安を判断し、正確な値は OS のシステム情報（Windows は「タスクマネージャー &gt;
            パフォーマンス」、mac は「このMacについて」）で確認してください。
          </p>
        </>
      )}
    </div>
  );
}
