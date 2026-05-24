import type { Metadata, Viewport } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import "./globals.css";

// Set NEXT_PUBLIC_SITE_URL=https://your-domain in production so OG/Twitter
// image URLs resolve to absolute URLs instead of falling back to localhost.
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "3D Connect Four — 立体 4 目並べ",
    template: "%s | 3D Connect Four",
  },
  description:
    "4×4×4 の立方体で繰り広げる、新次元の戦略バトル。縦・横・奥行き・対角線すべてが勝ち筋。2 プレイヤー / vs AI / オンライン対戦に対応。",
  applicationName: "3D Connect Four",
  keywords: [
    "3D Connect Four",
    "立体四目並べ",
    "4目並べ",
    "ボードゲーム",
    "オンライン対戦",
    "vs AI",
    "Three.js",
    "戦略ゲーム",
  ],
  authors: [{ name: "AkiraShingu" }],
  creator: "AkiraShingu",
  category: "game",
  openGraph: {
    type: "website",
    title: "3D Connect Four — 立体 4 目並べ",
    description:
      "4×4×4 の立方体で 4 つ並べたら勝ち。縦・横・奥行き・対角線すべてが勝ち筋の、立体 4 目並べ。",
    siteName: "3D Connect Four",
    locale: "ja_JP",
    images: [
      {
        url: "/connect4-title-background.png",
        width: 1200,
        height: 630,
        alt: "3D Connect Four — 立体 4 目並べゲーム",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "3D Connect Four — 立体 4 目並べ",
    description:
      "4×4×4 の立方体で繰り広げる、新次元の戦略バトル。2 プレイヤー / vs AI / オンライン対戦。",
    images: ["/connect4-title-background.png"],
  },
  robots: {
    index: true,
    follow: true,
  },
};

export const viewport: Viewport = {
  themeColor: "#0f172a",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <head>
        <style>{`
html {
  font-family: ${GeistSans.style.fontFamily};
  --font-sans: ${GeistSans.variable};
  --font-mono: ${GeistMono.variable};
}
        `}</style>
      </head>
      <body>{children}</body>
    </html>
  );
}
