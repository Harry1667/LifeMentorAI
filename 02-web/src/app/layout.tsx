import type { Metadata, Viewport } from 'next'
import { ClerkProvider } from '@clerk/nextjs'
import ServiceWorkerRegister from '@/components/ServiceWorkerRegister'
import './globals.css'

export const metadata: Metadata = {
  title: 'Mentora',
  description: '你的私人圓桌智者',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Mentora',
  },
  icons: {
    icon: '/icons/icon-192.png',
    apple: '/icons/apple-touch-icon.png',
  },
}

export const viewport: Viewport = {
  themeColor: '#1a1814',
  viewportFit: 'cover',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <ClerkProvider>
      <html lang="zh-TW" className="h-full">
        <body className="h-full antialiased">
          <ServiceWorkerRegister />
          {children}
        </body>
      </html>
    </ClerkProvider>
  )
}
