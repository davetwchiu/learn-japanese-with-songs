import type { Metadata } from "next";
import { HomeView } from "./site-client";

export const metadata: Metadata = {
  title: "聽歌學日文｜一邊聽，一邊讀懂日文",
  description:
    "逐句翻譯、文法拆解、ruby 假名注音與生字索引，把喜歡的日文歌變成實用課堂。",
};

export default function Home() {
  return <HomeView />;
}
