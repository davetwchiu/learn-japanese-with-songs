import type { Metadata } from "next";
import { IndexView } from "../site-client";

export const metadata: Metadata = {
  title: "生字索引",
  description: "附 ruby 假名讀音、意思和用法的跨歌曲日文生字索引。",
};

export default function VocabularyPage() {
  return <IndexView kind="vocabulary" />;
}
