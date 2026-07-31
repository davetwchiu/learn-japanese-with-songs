import type { Metadata } from "next";
import { SongView } from "../../site-client";

export const metadata: Metadata = {
  title: "歌曲課堂",
  description: "逐句翻譯、文法、生字和實用句子的完整日文歌曲課堂。",
};

export default async function SongPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return <SongView slug={slug} />;
}
