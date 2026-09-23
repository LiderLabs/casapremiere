import React from "react"
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import './globals.css'

const inter = Inter({ subsets: ["latin"], variable: '--font-inter' });

export const metadata: Metadata = { 
  title: 'CASA Premier — Premium Property & Interior Design in Accra',
  description: 'Premium real estate and interior design in Accra — curated properties, considered interiors, property development and renovation.',
  generator: 'v0.app',
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
      <body className={`${inter.variable} font-sans antialiased`}>
        {children}
        <Analytics />
      </body>
    </html>
  )
}
