import type { Metadata, Viewport } from "next";
import { Noto_Sans_JP, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";

// 本文・見出し（日本語が主役なので JP フォントを基準にする）
const sans = Noto_Sans_JP({
  subsets: ["latin"],
  weight: ["400", "700", "900"],
  variable: "--font-sans",
  display: "swap",
});

// ラベル・数値・コマンド用の等幅（機材然とした表示に効く）
const mono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "600"],
  variable: "--font-mono",
  display: "swap",
});

const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ||
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:4040");

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "FORGE — ローカルGPUで動く音楽制作スタジオ",
    template: "%s | FORGE",
  },
  description:
    "手元の ComfyUI で曲を生成し、内蔵エディタで編集し、Luster で仕上げる。クラウドの月間上限もアップロードもなく、すべてあなたのPCの中で完結するオープンソースの音楽制作スタジオ。",
  keywords: [
    "音楽生成", "ローカル", "ComfyUI", "ACE-Step", "Demucs",
    "マスタリング", "オープンソース", "AI作曲", "DAW",
  ],
  openGraph: {
    type: "website",
    locale: "ja_JP",
    siteName: "FORGE",
    title: "FORGE — ローカルGPUで動く音楽制作スタジオ",
    description:
      "生成 → 編集 → 仕上げまで、すべて手元のPCで。オープンソースのローカル音楽制作スタジオ。",
    images: [{ url: "/og.png", width: 1200, height: 630, alt: "FORGE — Local Music Studio" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "FORGE — ローカルGPUで動く音楽制作スタジオ",
    description: "生成 → 編集 → 仕上げまで、すべて手元のPCで。",
    images: ["/og.png"],
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: "#0a0a0c",
  colorScheme: "dark",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja" className={`${sans.variable} ${mono.variable}`}>
      <body>
        <Nav />
        <main>{children}</main>
        <Footer />
      </body>
    </html>
  );
}
