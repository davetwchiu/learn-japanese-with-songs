import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";
import { isPasswordAuthenticated } from "./password-auth";
import { LoginView } from "./login-client";

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
    icons: {
      icon: [
        {
          url: "/icon-512.png",
          sizes: "512x512",
          type: "image/png",
        },
      ],
      shortcut: "/icon-512.png",
      apple: [
        {
          url: "/apple-touch-icon.png",
          sizes: "180x180",
          type: "image/png",
        },
      ],
    },
    appleWebApp: {
      capable: true,
      statusBarStyle: "default",
      title: "聽歌學日文",
    },
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

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const authenticated = await isPasswordAuthenticated();
  return (
    <html lang="zh-HK">
      <body>{authenticated ? children : <LoginView />}</body>
    </html>
  );
}
