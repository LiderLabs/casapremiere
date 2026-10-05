// The in-app reader behind /docs.
//
// `docs/*.md` is the single source of truth: it is the file an editor opens on GitHub, the file
// MkDocs publishes (see mkdocs.yml), and the file this module compiles to static HTML at build
// time with the unified/remark/rehype toolchain. Nothing is hand-copied, so the three renderings
// cannot drift apart, and the /docs pages ship no client JavaScript.
//
// Two details make one Markdown source serve both renderers:
//
// - Anchors come from `github-slugger`, the package GitHub itself uses (directly for this
//   module's on-page nav, and through rehype-slug for the rendered headings). A heading such as
//   "## 17. Runbook — moving Turso and R2 to new accounts" is therefore addressable at exactly
//   the anchor README.md already links to: #17-runbook--moving-turso-and-r2-to-new-accounts.
// - A cross-document link written as `[the CMS notes](cms.md)` is rewritten to `/docs/cms` here,
//   while MkDocs performs its own equivalent rewrite, so neither renderer needs a bespoke link.
//
// Server-only: it reads the filesystem. No client component may import it.

import fs from "node:fs";
import path from "node:path";
import GithubSlugger from "github-slugger";
import rehypeSlug from "rehype-slug";
import rehypeStringify from "rehype-stringify";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import { unified } from "unified";
import type { Plugin } from "unified";

const DOCS_DIR = path.join(process.cwd(), "docs");

/** Slug of the landing page. It is the /docs index, and MkDocs' home page. */
export const DOCS_HOME = "index";

/** Nav order. Anything not named here follows, alphabetically. */
const ORDER = [DOCS_HOME, "project-documentation", "cms", "cms-runbook"];

export type DocHeading = {
  /** Anchor id, matching the heading's `id` in the rendered HTML. */
  id: string;
  text: string;
  /** Only h2 and h3 carry a useful on-page outline in these documents. */
  level: 2 | 3;
};

export type DocSummary = {
  /** URL segment: /docs/<slug>. */
  slug: string;
  /** The document's `# Title`. */
  title: string;
};

export type Doc = DocSummary & {
  headings: DocHeading[];
  /** The document body as static HTML, with its own `# Title` removed. */
  html: string;
};

/** Just enough of mdast/hast to walk the trees without pulling in their types. */
type MdNode = { type: string; value?: string; depth?: number; children?: MdNode[] };
type HastNode = {
  type: string;
  tagName?: string;
  properties?: Record<string, unknown>;
  children?: HastNode[];
};

/**
 * Drop the document's own `# Title`. The page renders it as a real header instead, so it is not
 * repeated at the top of the prose.
 */
const stripTitle: Plugin = () => (tree) => {
  const root = tree as unknown as { children?: { type?: string; depth?: number }[] };
  const index = root.children?.findIndex((child) => child.type === "heading" && child.depth === 1) ?? -1;
  if (root.children && index > -1) root.children.splice(index, 1);
};

/** `[the CMS notes](cms.md#the-api)` -> `/docs/cms#the-api`. */
const DOC_LINK = /^(?:\.\/)?([A-Za-z0-9._-]+)\.md(#.*)?$/;

const rewriteDocLinks: Plugin = () => (tree) => {
  walkHast(tree as unknown as HastNode, (node) => {
    if (node.tagName !== "a" || !node.properties) return;
    const href = node.properties.href;
    if (typeof href !== "string") return;
    const link = DOC_LINK.exec(href);
    if (!link || !isDoc(link[1])) return;
    const slug = link[1].toLowerCase();
    node.properties.href = (slug === DOCS_HOME ? "/docs" : `/docs/${slug}`) + (link[2] ?? "");
  });
};

// One pipeline for every document. rehype-slug resets its slugger per tree, so reuse is safe.
const processor = unified()
  .use(remarkParse)
  .use(remarkGfm)
  .use(stripTitle)
  .use(remarkRehype)
  .use(rewriteDocLinks)
  .use(rehypeSlug)
  .use(rehypeStringify);

// Parsed documents, keyed by slug. Cached in production only, so a local `npm run dev` picks up
// an edit to a .md file on the next reload.
const cache = new Map<string, Promise<Doc | null>>();
const cacheEnabled = process.env.NODE_ENV === "production";

/** Every `docs/*.md`, in nav order. */
function docFiles(): { slug: string; file: string }[] {
  if (!fs.existsSync(DOCS_DIR)) return [];
  return fs
    .readdirSync(DOCS_DIR)
    .filter((name) => name.toLowerCase().endsWith(".md"))
    .map((name) => ({ slug: name.slice(0, -3).toLowerCase(), file: path.join(DOCS_DIR, name) }))
    .sort((a, b) => rank(a.slug) - rank(b.slug) || a.slug.localeCompare(b.slug));
}

function rank(slug: string): number {
  const index = ORDER.indexOf(slug);
  return index === -1 ? ORDER.length : index;
}

function isDoc(slug: string): boolean {
  return docFiles().some((doc) => doc.slug === slug.toLowerCase());
}

function parse(markdown: string): MdNode {
  return unified().use(remarkParse).use(remarkGfm).parse(markdown) as unknown as MdNode;
}

/** The rendered text of a node: `**bold**` and `[links](…)` reduce to their text. */
function textOf(node: MdNode): string {
  if (typeof node.value === "string") return node.value;
  return (node.children ?? []).map(textOf).join("");
}

function titleOf(root: MdNode): string {
  const heading = (root.children ?? []).find((child) => child.type === "heading" && child.depth === 1);
  return heading ? textOf(heading).trim() : "Documentation";
}

/**
 * The on-page outline. Every heading is slugged in document order — including h1, h4–h6 and any
 * heading inside a blockquote — because that is the order rehype-slug sees, and the two must agree
 * on the id of a repeated heading ("Overview" after "Overview" becomes "overview-1" in both).
 */
function outlineOf(root: MdNode): DocHeading[] {
  const slugger = new GithubSlugger();
  const headings: DocHeading[] = [];
  const walk = (nodes: MdNode[]) => {
    for (const node of nodes) {
      if (node.type === "heading") {
        const text = textOf(node).trim();
        const id = slugger.slug(text);
        const level = node.depth;
        if (level === 2 || level === 3) headings.push({ id, text, level });
      }
      walk(node.children ?? []);
    }
  };
  walk(root.children ?? []);
  return headings;
}

function walkHast(node: HastNode, visit: (node: HastNode) => void): void {
  visit(node);
  for (const child of node.children ?? []) walkHast(child, visit);
}

async function load(slug: string): Promise<Doc | null> {
  const file = docFiles().find((doc) => doc.slug === slug)?.file;
  if (!file) return null;
  const markdown = fs.readFileSync(file, "utf8");
  const root = parse(markdown);
  const html = String(await processor.process(markdown));
  return {
    slug,
    title: titleOf(root),
    headings: outlineOf(root),
    html,
  };
}

/** Every document except the landing page, in nav order — the sidebar and the /docs index. */
export function listDocs(): DocSummary[] {
  return docFiles()
    .filter((doc) => doc.slug !== DOCS_HOME)
    .map((doc) => ({ slug: doc.slug, title: titleOf(parse(fs.readFileSync(doc.file, "utf8"))) }));
}

/** The slugs /docs is built for. */
export function docSlugs(): string[] {
  return docFiles()
    .filter((doc) => doc.slug !== DOCS_HOME)
    .map((doc) => doc.slug);
}

/** One document, compiled. `null` when there is no such file. */
export function getDoc(slug: string): Promise<Doc | null> {
  const key = slug.toLowerCase();
  if (!cacheEnabled) return load(key);
  const pending = cache.get(key);
  if (pending) return pending;
  const promise = load(key);
  cache.set(key, promise);
  return promise;
}
