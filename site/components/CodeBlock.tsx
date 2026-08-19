"use client";
// コマンド表示用のブロック。# 以降をコメント色にし、右上にコピーボタンを置く。
import { useState } from "react";

export function CodeBlock({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // クリップボードが使えない環境では何もしない（手動選択でコピーできる）
    }
  };

  return (
    <div className="codeblock">
      <button className="copy-btn" onClick={copy} aria-label="コマンドをコピー">
        {copied ? "コピーしました" : "コピー"}
      </button>
      <pre>
        <code>
          {code.split("\n").map((line, i) => {
            const idx = line.indexOf("#");
            if (idx >= 0) {
              return (
                <span key={i}>
                  {line.slice(0, idx)}
                  <span className="c">{line.slice(idx)}</span>
                  {"\n"}
                </span>
              );
            }
            return (
              <span key={i}>
                {line}
                {"\n"}
              </span>
            );
          })}
        </code>
      </pre>
    </div>
  );
}
