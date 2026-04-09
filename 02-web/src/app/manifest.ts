import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Mentora — 你的私人圓桌智者',
    short_name: 'Mentora',
    description: 'AI 人生導師對話平台，與富蘭克林、費曼、斯多葛智者圓桌對話',
    start_url: '/',
    display: 'standalone',
    background_color: '#1a1814',
    theme_color: '#1a1814',
    orientation: 'portrait',
    categories: ['lifestyle', 'education'],
    lang: 'zh-TW',
    icons: [
      {
        src: '/icons/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: '/icons/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
      },
      {
        src: '/icons/icon-maskable-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  }
}
