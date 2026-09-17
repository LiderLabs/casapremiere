import type React from "react"
import type { Metadata } from "next"
import { Geist_Mono } from "next/font/google"
import { Analytics } from "@vercel/analytics/next"
import "./globals.css"

const _geistMono = Geist_Mono({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "CASA- INTERIOR",
  description:
    "We design spaces that elevate living. A refined architectural experience where form, light, and intention meet.",
  generator: "v0.app",
  icons: {
    other: [
      {
        rel: "icon",
        url: "/CASA1.png",
        media: "(prefers-color-scheme: light)",
        type: "image/png",
      },
      {
        rel: "icon",
        url: "/casa copy.svg",
        media: "(prefers-color-scheme: dark)",
        type: "image/svg+xml",
      },
    ],
    apple: "/CASA1.png",
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body className="font-sans antialiased">
        {children}
        <Analytics />
      </body>
    </html>
  )
}
