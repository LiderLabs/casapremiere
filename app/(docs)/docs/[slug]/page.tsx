import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { docSlugs, getDoc } from "@/lib/docs";

import { DocsShell } from "../docs-shell";

// /docs/<slug> — one page per Markdown file in docs/. There is nothing to fetch at request time:
// the Markdown is read and compiled during the build, and every anchor in the output is the one
// GitHub would generate for the same heading (see lib/docs.ts).

/** The slugs are known at build time, so an unknown one is a 404 rather than a request-time render. */
export const dynamicParams = false;

export function generateStaticParams() {
  return docSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const doc = await getDoc(slug);
  return { title: doc ? `${doc.title} — CASA Première docs` : "Documentation — CASA Première" };
}

export default async function DocPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const doc = await getDoc(slug);
  if (!doc) notFound();

  return (
    <DocsShell active={doc.slug} title={doc.title} headings={doc.headings} html={doc.html} />
  );
}
