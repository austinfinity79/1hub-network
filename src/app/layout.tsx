import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: '1hub.network',
  description: '1hub.network Phase 0',
}

/**
 * Be Vietnam Pro 400 is the default UI face, so its latin and vietnamese
 * subsets are preloaded. With font-display: block this removes the invisible
 * period before first paint. The remaining faces load on demand.
 */
const PRELOADED_FONTS = [
  '/fonts/be-vietnam-pro-latin-400-normal.woff2',
  '/fonts/be-vietnam-pro-vietnamese-400-normal.woff2',
]

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi">
      <head>
        {PRELOADED_FONTS.map((href) => (
          <link
            key={href}
            rel="preload"
            href={href}
            as="font"
            type="font/woff2"
            crossOrigin="anonymous"
          />
        ))}
      </head>
      <body>{children}</body>
    </html>
  )
}
