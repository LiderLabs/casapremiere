import { notFound } from "next/navigation";

import { getDoc } from "@/lib/docs";

import { DocsShell } from "./docs-shell";

// /docs — the landing page, compiled from docs/index.md. That file is also the MkDocs home page,
// which is why it lives in docs/ rather than being written as JSX here: one landing page, two sites.

export default async function DocsIndexPage() {
  const doc = await getDoc("index");
  if (!doc) notFound();

  return <DocsShell active="index" title={doc.title} headings={[]} html={doc.html} />;
}
