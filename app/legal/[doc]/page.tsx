import { readFile } from "node:fs/promises";
import path from "node:path";
import { marked } from "marked";
import { notFound } from "next/navigation";

// The legal pages are plain text files in content/legal. Edit the text there.
const docs = ["terms", "creator-license", "copyright", "removal"];

export function generateStaticParams() {
  return docs.map((doc) => ({ doc }));
}
export const dynamicParams = false;

export default async function Legal({ params }: { params: Promise<{ doc: string }> }) {
  const { doc } = await params;
  if (!docs.includes(doc)) notFound();
  const source = await readFile(path.join(process.cwd(), "content", "legal", `${doc}.md`), "utf8");
  // The text comes from our own files, never from users, so rendering it as HTML is safe.
  const html = await marked.parse(source);
  return <article className="legal" dangerouslySetInnerHTML={{ __html: html }} />;
}
