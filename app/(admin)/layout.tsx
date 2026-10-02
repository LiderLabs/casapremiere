import type React from "react";
import type { Metadata } from "next";

import { Toaster } from "@/components/ui/sonner";

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
      <body className="min-h-dvh antialiased">
        {children}
        {/* One toast surface for the whole admin, including sign-in and the password screen.
            The admin is light-only by design (see globals.css), so the theme is pinned rather
            than read from next-themes - there is no ThemeProvider on this surface. */}
        <Toaster theme="light" position="top-right" richColors closeButton />
      </body>
    </html>
  );
}
