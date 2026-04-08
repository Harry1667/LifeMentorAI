import type { Metadata } from 'next'
import { ClerkProvider } from '@clerk/nextjs'
import './globals.css'

export const metadata: Metadata = {
  title: 'Mentora',
  description: '你的私人圓桌智者',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <ClerkProvider>
      <html lang="zh-TW" className="h-full">
        <body className="h-full antialiased">{children}</body>
      </html>
    </ClerkProvider>
  )
}
