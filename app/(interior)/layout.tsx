import type React from "react"
import type { Metadata } from "next"
import { Geist_Mono } from "next/font/google"
import { Analytics } from "@vercel/analytics/next"
import { BookingProvider } from "@/components/booking/booking-provider"
import "./globals.css"

const _geistMono = Geist_Mono({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "CASA Premier — Interiors",
  description:
    "Interior design by CASA Premier: space planning, bespoke joinery and material palettes for homes in Adjiringanor, Accra and across the estate.",
  generator: "v0.app",
  icons: {
  icon: ['/logowhite.png', '/logowhite.png'],   // (site): single-quoted, (interior): double-quoted to match each file's style
  apple: '/CASA-512x512.png',
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
        <BookingProvider>{children}</BookingProvider>
        <Analytics />
      </body>
    </html>
  )
}
