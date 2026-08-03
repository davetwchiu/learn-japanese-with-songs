import type { Metadata } from "next";
import { ImportView } from "./import-client";
import { redirect } from "next/navigation";
import { isMirrorReadOnly } from "../runtime-mode";

export const metadata: Metadata = {
  title: "匯入課文",
  description: "由檔案、網址或貼上文字匯入日文歌曲學習課文。",
};

export default function ImportPage() {
  if (isMirrorReadOnly()) redirect("/");
  return <ImportView />;
}
