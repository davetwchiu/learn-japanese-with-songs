import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host =
    requestHeaders.get("x-forwarded-host") ??
    requestHeaders.get("host") ??
    "localhost:3000";
  const protocol =
    requestHeaders.get("x-forwarded-proto") ??
    (host.startsWith("localhost") ? "http" : "https");
  const base = new URL(`${protocol}://${host}`);
  const image = new URL("/og.png", base).toString();

  return {
    metadataBase: base,
    title: {
      default: "聽歌學日文",
      template: "%s｜聽歌學日文",
    },
    description:
      "逐句翻譯、文法拆解、ruby 假名注音與生字索引，把喜歡的日文歌變成實用課堂。",
    icons: { icon: "/og.png", shortcut: "/og.png" },
    openGraph: {
      type: "website",
      locale: "zh_HK",
      title: "聽歌學日文",
      description: "一邊聽・一邊讀・一邊學",
      images: [{ url: image, width: 1200, height: 630 }],
    },
    twitter: {
      card: "summary_large_image",
      title: "聽歌學日文",
      description: "一邊聽・一邊讀・一邊學",
      images: [image],
    },
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-HK">
      <body>{children}</body>
    </html>
  );
}
