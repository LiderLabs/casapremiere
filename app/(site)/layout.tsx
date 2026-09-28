import React from "react"
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import { ThemeProvider } from '@/components/theme-provider'
import { Toaster } from '@/components/ui/sonner'
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
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} font-sans antialiased`}>
        {/* Light/dark theming is estate-site only for now, and always starts in
            light: `enableSystem` is off, so the header toggle is the only way
            into dark mode. The `.dark` token block it switches on lives in
            app/(site)/globals.css. */}
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem={false}
          disableTransitionOnChange
        >
          {children}
          {/* Toast surface for shortlist feedback. Sits under the header pill
              offset so it never covers the nav. */}
          <Toaster position="top-center" offset={88} />
        </ThemeProvider>
        <Analytics />
      </body>
    </html>
  )
}
