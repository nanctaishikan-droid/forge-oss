// FORGE アイコン集 — ミニマルで統一感のあるラインアイコン（Lucide系ジオメトリ）。
// stroke=currentColor で色は親に追従。strokeWidth=2 / round で小サイズでもきれい。
import * as React from "react";

type P = { size?: number; className?: string; strokeWidth?: number };

function S({
  size = 16,
  className,
  strokeWidth = 2,
  children,
}: P & { children: React.ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

// ロゴ: 角丸スクエア＋シンプルな波形（オレンジ）
export function Logo({ size = 24, className }: P) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} aria-hidden="true">
      <rect x="2" y="2" width="20" height="20" rx="6" fill="var(--accent)" opacity="0.16" />
      <rect
        x="2.5"
        y="2.5"
        width="19"
        height="19"
        rx="5.5"
        fill="none"
        stroke="var(--accent)"
        strokeOpacity="0.5"
      />
      <path
        d="M6 12h1.5l1.5-4 2 8 2-9 2 7 1.5-2H18"
        fill="none"
        stroke="var(--accent)"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// 音符（music）
export const Note = (p: P) => (
  <S {...p}>
    <path d="M9 18V5l12-2v13" />
    <circle cx="6" cy="18" r="3" />
    <circle cx="18" cy="16" r="3" />
  </S>
);

// マイク
export const Mic = (p: P) => (
  <S {...p}>
    <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
    <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
    <path d="M12 19v3" />
  </S>
);

// 波形（audio-waveform）
export const Wave = (p: P) => (
  <S {...p}>
    <path d="M2 13a2 2 0 0 0 2-2V7a2 2 0 0 1 4 0v13a2 2 0 0 0 4 0V4a2 2 0 0 1 4 0v13a2 2 0 0 0 4 0v-4a2 2 0 0 1 2-2" />
  </S>
);

// 波形ライン（audio-lines）— 編集向け
export const Edit = (p: P) => (
  <S {...p}>
    <path d="M2 10v3M6 6v11M10 3v18M14 8v7M18 5v13M22 10v3" />
  </S>
);

// ミキサー（sliders）
export const Sliders = (p: P) => (
  <S {...p}>
    <path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3" />
    <path d="M2 14h4M10 8h4M18 16h4" />
  </S>
);

// スペクトル（bars）
export const Spectrum = (p: P) => (
  <S {...p}>
    <path d="M6 20v-6M12 20V4M18 20v-9" />
  </S>
);

// 生成（sparkles）
export const Spark = (p: P) => (
  <S {...p}>
    <path d="M12 3l1.6 4.4L18 9l-4.4 1.6L12 15l-1.6-4.4L6 9l4.4-1.6L12 3Z" />
    <path d="M19 15l.7 1.8L21.5 17.5l-1.8.7L19 20l-.7-1.8L16.5 17.5l1.8-.7L19 15Z" />
  </S>
);

// ダウンロード
export const Download = (p: P) => (
  <S {...p}>
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <path d="M7 10l5 5 5-5" />
    <path d="M12 15V3" />
  </S>
);

// 再生 / 一時停止
export const Play = (p: P) => (
  <S {...p}>
    <path d="M6 4.5v15l13-7.5-13-7.5Z" fill="currentColor" stroke="none" />
  </S>
);
export const Pause = (p: P) => (
  <S {...p}>
    <rect x="6" y="4" width="4" height="16" rx="1" fill="currentColor" stroke="none" />
    <rect x="14" y="4" width="4" height="16" rx="1" fill="currentColor" stroke="none" />
  </S>
);

// アルバム（disc）
export const Disc = (p: P) => (
  <S {...p}>
    <circle cx="12" cy="12" r="10" />
    <circle cx="12" cy="12" r="2" />
  </S>
);

// 分解（layers）
export const Layers = (p: P) => (
  <S {...p}>
    <path d="M12.8 2.2a2 2 0 0 0-1.6 0L2.6 6.1a1 1 0 0 0 0 1.8l8.6 3.9a2 2 0 0 0 1.6 0l8.6-3.9a1 1 0 0 0 0-1.8Z" />
    <path d="m22 17.6-9.2 4.2a2 2 0 0 1-1.6 0L2 17.6" />
    <path d="m22 12.6-9.2 4.2a2 2 0 0 1-1.6 0L2 12.6" />
  </S>
);

// マスタリング（gauge）
export const Gauge = (p: P) => (
  <S {...p}>
    <path d="M12 14l4-4" />
    <path d="M3.3 19a10 10 0 1 1 17.3 0" />
  </S>
);

// 切る（scissors）
export const Scissors = (p: P) => (
  <S {...p}>
    <circle cx="6" cy="6" r="3" />
    <circle cx="6" cy="18" r="3" />
    <path d="M8.1 8.1 20 18M8.1 15.9 20 6M14.8 14.8 20 18" />
  </S>
);

// 時計（schedule）
export const Clock = (p: P) => (
  <S {...p}>
    <circle cx="12" cy="12" r="10" />
    <path d="M12 6v6l4 2" />
  </S>
);

// ライブラリ（library）
export const Library = (p: P) => (
  <S {...p}>
    <path d="m16 6 4 14M12 6v14M8 8v12M4 4v16" />
  </S>
);

// ナレーション（message）
export const Voice = (p: P) => (
  <S {...p}>
    <path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" />
    <path d="M8 12h.01M12 12h.01M16 12h.01" />
  </S>
);

// ステータス（cpu）
export const Chip = (p: P) => (
  <S {...p}>
    <rect x="4" y="4" width="16" height="16" rx="2" />
    <rect x="9" y="9" width="6" height="6" rx="1" />
    <path d="M9 2v2M15 2v2M9 20v2M15 20v2M2 9h2M2 15h2M20 9h2M20 15h2" />
  </S>
);

// くり返し
export const Repeat = (p: P) => (
  <S {...p}>
    <path d="m17 2 4 4-4 4" />
    <path d="M3 11v-1a4 4 0 0 1 4-4h14" />
    <path d="m7 22-4-4 4-4" />
    <path d="M21 13v1a4 4 0 0 1-4 4H3" />
  </S>
);

// 汎用
export const Plus = (p: P) => (
  <S {...p}>
    <path d="M12 5v14M5 12h14" />
  </S>
);
export const Trash = (p: P) => (
  <S {...p}>
    <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M10 11v6M14 11v6" />
  </S>
);
export const X = (p: P) => (
  <S {...p}>
    <path d="M18 6 6 18M6 6l12 12" />
  </S>
);
export const Chevron = (p: P) => (
  <S {...p}>
    <path d="m6 9 6 6 6-6" />
  </S>
);
