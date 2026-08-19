"use client";
// 常時表示のスリムなナビゲーション。現在地をアクセント色で示す。
import Link from "next/link";
import { usePathname } from "next/navigation";
import { REPO_URL } from "@/lib/song";

const LINKS = [
  { href: "/", label: "ホーム" },
  { href: "/features", label: "機能" },
  { href: "/setup", label: "導入ガイド" },
  { href: "/specs", label: "必要スペック" },
];

export function Nav() {
  const path = usePathname();
  return (
    <nav className="nav">
      <div className="wrap nav-inner">
        <Link href="/" className="brand">
          <span className="brand-mark">F</span>
          <span>FORGE</span>
        </Link>

        <div className="nav-links">
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="nav-link"
              data-active={path === l.href}
            >
              {l.label}
            </Link>
          ))}
        </div>

        <a className="nav-cta" href={REPO_URL} target="_blank" rel="noopener noreferrer">
          <svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor" aria-hidden="true">
            <path d="M12 .5C5.7.5.5 5.7.5 12c0 5.1 3.3 9.4 7.8 10.9.6.1.8-.2.8-.6v-2c-3.2.7-3.9-1.5-3.9-1.5-.5-1.3-1.3-1.7-1.3-1.7-1-.7.1-.7.1-.7 1.1.1 1.7 1.2 1.7 1.2 1 1.8 2.7 1.3 3.4 1 .1-.7.4-1.3.7-1.6-2.6-.3-5.3-1.3-5.3-5.8 0-1.3.5-2.3 1.2-3.2-.1-.3-.5-1.5.1-3.1 0 0 1-.3 3.2 1.2a11 11 0 0 1 5.8 0C17 4.7 18 5 18 5c.6 1.6.2 2.8.1 3.1.8.9 1.2 1.9 1.2 3.2 0 4.5-2.7 5.5-5.3 5.8.4.4.8 1.1.8 2.2v3.3c0 .3.2.7.8.6 4.6-1.5 7.8-5.8 7.8-10.9C23.5 5.7 18.3.5 12 .5z" />
          </svg>
          GitHub
        </a>
      </div>
    </nav>
  );
}
