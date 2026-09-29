import type React from "react";
import type { Metadata } from "next";

import "./globals.css";

// The admin is the third root layout in this app, alongside (site) and (interior). Each route
// group owns its own <html>/<body> so the three surfaces cannot share or leak styles - which
// is exactly why the two public sites were verified pixel-identical when they were merged.

export const metadata: Metadata = {
  title: "CASA Première — Content",
  description: "Content management for casapremiere.com",
  robots: { index: false, follow: false },
};

export default function AdminRootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="min-h-dvh antialiased">{children}</body>
    </html>
  );
}
