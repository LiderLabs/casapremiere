import React from "react"
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import './globals.css'

const inter = Inter({ subsets: ["latin"], variable: '--font-inter' });

export const metadata: Metadata = { 
  title: 'CASA',
  description: 'High-performance outdoor gear engineered for the modern explorer. Lightweight, durable, adventure-ready.',
  generator: 'v0.app',
  icons: {
    other: [
      {
        rel: 'icon',
        url: '/CASA1.png',
        media: '(prefers-color-scheme: light)',
        type: 'image/png',
      },
      {
        rel: 'icon',
        url: '/casa copy.svg',
        media: '(prefers-color-scheme: dark)',
        type: 'image/svg+xml',
      },
    ],
    apple: '/CASA1.png',
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
