import type { Metadata } from "next";
import { ManageLessonView } from "./manage-client";
import { redirect } from "next/navigation";
import { isMirrorReadOnly } from "../../../runtime-mode";

export const metadata: Metadata = {
  title: "管理課文",
  description: "後補 YouTube 影片或刪除不再需要的課文。",
};

export default async function ManageLessonPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  if (isMirrorReadOnly()) redirect("/");
  const { slug } = await params;
  return <ManageLessonView slug={slug} />;
}
