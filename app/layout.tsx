import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'RTX 3060 Deals Database',
  description: 'Search and filter RTX 3060 deals from major retailers',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>
        {children}
      </body>
    </html>
  )
}
