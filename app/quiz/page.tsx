import type { Metadata } from "next";
import { QuizView } from "../quiz-client";

export const metadata: Metadata = {
  title: "生字測驗",
  description: "選擇歌曲和題數，隨機測試日文生字的讀音與意思。",
};

export default function QuizPage() {
  return <QuizView />;
}
