import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: '1hub.network',
  description: '1hub.network Phase 0',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi">
      <body>{children}</body>
    </html>
  )
}
