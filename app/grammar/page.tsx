import type { Metadata } from "next";
import { IndexView } from "../site-client";

export const metadata: Metadata = {
  title: "文法索引",
  description: "由所有歌曲整理而成的日文文法索引。",
};

export default function GrammarPage() {
  return <IndexView kind="grammar" />;
}
