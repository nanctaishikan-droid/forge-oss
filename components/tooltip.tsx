"use client";
// カーソルを合わせると説明が出るツールチップ。専門用語の解説に使う。
import * as React from "react";

export function Tip({
  text,
  children,
  className,
  below = false,
}: {
  text: string;
  children: React.ReactNode;
  className?: string;
  below?: boolean; // true=下に表示（上部のボタン用。ヘッダーに隠れない）
}) {
  const [show, setShow] = React.useState(false);
  return (
    <span
      className={`relative inline-flex items-center ${className || ""}`}
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
    >
      {children}
      {show && (
        <span
          role="tooltip"
          className={`absolute z-[200] left-1/2 -translate-x-1/2 w-56 rounded-lg bg-zinc-900 border border-[var(--border)] px-3 py-2 text-[11px] leading-relaxed text-zinc-200 shadow-xl pointer-events-none ${
            below ? "top-full mt-1.5" : "bottom-full mb-1.5"
          }`}
        >
          {text}
          <span
            className={`absolute left-1/2 -translate-x-1/2 w-2 h-2 rotate-45 bg-zinc-900 ${
              below
                ? "bottom-full -mb-1 border-l border-t border-[var(--border)]"
                : "top-full -mt-1 border-r border-b border-[var(--border)]"
            }`}
          />
        </span>
      )}
    </span>
  );
}

// 小さな「?」ヘルプバッジ（Tipでラップして使う）
export function HelpBadge({ className }: { className?: string }) {
  return (
    <span
      className={`inline-flex items-center justify-center w-3.5 h-3.5 rounded-full border border-current text-[9px] font-bold cursor-help ${
        className || "text-[var(--text-dim)]"
      }`}
    >
      ?
    </span>
  );
}
