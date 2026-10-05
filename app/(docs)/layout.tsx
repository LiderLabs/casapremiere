import type React from "react";
import type { Metadata } from "next";
import Link from "next/link";

import "./globals.css";

// The docs are the fourth root layout in this app, alongside (site), (interior) and (admin). Each
// route group owns its own <html>/<body> so the four surfaces cannot share or leak styles.
//
// Nothing in this group is a client component and no analytics script is loaded: every /docs page is
// prerendered from docs/*.md at build time (lib/docs.ts), so no component here ever hydrates and the
// sidebar's active state is decided during the build. `/docs` is public - proxy.ts only guards
// /admin and /api/admin.

const REPO = "https://github.com/LiderLabs/casapremiere";
const PUBLISHED = "https://liderlabs.github.io/casapremiere/";

export const metadata: Metadata = {
  title: "Documentation — CASA Première",
  description:
    "The CASA Première project documents, rendered from the Markdown in docs/ by the app itself.",
  icons: {
    icon: ["/logowhite.png", "/logowhite.png"],
    apple: "/CASA-512x512.png",
  },
};

export default function DocsRootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="docs-body">
        <header className="docs-topbar">
          <Link className="docs-brand" href="/">
            CASA Première
          </Link>
          <nav>
            <Link href="/">Estate site</Link>
            <Link href="/interior">Interiors</Link>
            <a href={REPO}>Source</a>
          </nav>
        </header>

        {children}

        <footer className="docs-footer">
          Markdown source: <a href={`${REPO}/tree/main/docs`}>docs/</a> — the same files are published
          at <a href={PUBLISHED}>liderlabs.github.io/casapremiere</a> by `.github/workflows/docs.yml`.
        </footer>
      </body>
    </html>
  );
}
