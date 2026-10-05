import Link from "next/link";

import { listDocs } from "@/lib/docs";
import type { DocHeading } from "@/lib/docs";

// The chrome shared by /docs and /docs/<slug>: the document list on the left, the compiled prose in
// the middle, and - when a document is long enough to need one - its headings on the right.
//
// This is a server component, so the outline and the `aria-current` marker are resolved during the
// build rather than by a `usePathname` hook in the browser.

export function DocsShell({
  active,
  title,
  headings,
  html,
}: {
  /** Slug of the document on screen, or "index" for /docs itself. */
  active: string;
  title: string;
  headings: DocHeading[];
  /** The document body: static HTML from lib/docs.ts, already sanitised by being compiled here. */
  html: string;
}) {
  return (
    <div className="docs-shell">
      <aside className="docs-sidebar">
        <nav aria-label="Documents">
          <p className="docs-sidebar-label">Documents</p>
          <ul>
            <li>
              <Link href="/docs" aria-current={active === "index" ? "page" : undefined}>
                Overview
              </Link>
            </li>
            {listDocs().map((doc) => (
              <li key={doc.slug}>
                <Link
                  href={`/docs/${doc.slug}`}
                  aria-current={active === doc.slug ? "page" : undefined}
                >
                  {doc.title}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </aside>

      <div className={headings.length > 0 ? "docs-main docs-main--toc" : "docs-main"}>
        <article className="docs-article">
          {/* The document's own `# Title` is stripped from the Markdown, so this is the page's
              only h1 and the heading ids below keep matching GitHub's anchors. */}
          <h1>{title}</h1>
          <div dangerouslySetInnerHTML={{ __html: html }} />
        </article>

        {headings.length > 0 ? (
          <nav className="docs-toc" aria-label="On this page">
            <p className="docs-sidebar-label">On this page</p>
            <ul>
              {headings.map((heading) => (
                <li key={heading.id} className={heading.level === 3 ? "docs-toc-h3" : undefined}>
                  <a href={`#${heading.id}`}>{heading.text}</a>
                </li>
              ))}
            </ul>
          </nav>
        ) : null}
      </div>
    </div>
  );
}
