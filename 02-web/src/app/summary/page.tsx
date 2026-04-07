'use client'

import { useState } from 'react'
import { UserButton } from '@clerk/nextjs'
import Link from 'next/link'

export default function SummaryPage() {
  const [summary, setSummary] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function generateSummary() {
    setLoading(true)
    setSummary(null)
    try {
      const res = await fetch('/api/summary', { method: 'POST' })
      const data = await res.json()
      setSummary(data.summary)
    } catch {
      setSummary('摘要產生失敗，請稍後再試。')
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)' }}>
      <header
        className="flex items-center justify-between px-6 py-4 border-b"
        style={{ borderColor: 'var(--border-subtle)' }}
      >
        <div>
          <h1 className="text-lg font-semibold" style={{ color: 'var(--accent-gold)' }}>
            每週成長摘要
          </h1>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
            回顧你的對話、行動和成長模式
          </p>
        </div>
        <div className="flex items-center gap-4">
          <Link
            href="/chat"
            className="text-xs px-3 py-1.5 rounded-lg transition-opacity hover:opacity-80"
            style={{ border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}
          >
            回到對話
          </Link>
          <UserButton />
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-6 py-10">
        {!summary && !loading && (
          <div className="text-center py-16">
            <p className="text-base mb-4" style={{ color: 'var(--text-secondary)' }}>
              分析你過去一週的對話和行動，找出成長模式
            </p>
            <button
              onClick={generateSummary}
              className="px-6 py-3 rounded-xl text-sm font-medium text-white transition-opacity hover:opacity-90"
              style={{ backgroundColor: 'var(--accent-gold)' }}
            >
              產生本週摘要
            </button>
          </div>
        )}

        {loading && (
          <div className="text-center py-16">
            <div className="inline-flex items-center gap-2 text-sm" style={{ color: 'var(--text-muted)' }}>
              <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
              正在分析你的對話和行動紀錄...
            </div>
          </div>
        )}

        {summary && (
          <div className="space-y-6">
            <div
              className="prose prose-invert max-w-none rounded-xl p-6 text-sm leading-relaxed"
              style={{
                backgroundColor: 'var(--bg-chat)',
                border: '1px solid var(--border-subtle)',
                color: 'var(--text-primary)',
              }}
              dangerouslySetInnerHTML={{ __html: markdownToHtml(summary) }}
            />
            <div className="flex justify-center">
              <button
                onClick={generateSummary}
                className="text-xs px-4 py-2 rounded-lg transition-opacity hover:opacity-80"
                style={{ color: 'var(--text-muted)', border: '1px solid var(--border-subtle)' }}
              >
                重新產生
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// 跳脫 HTML 特殊字元，防止 XSS
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

// 簡易 markdown → HTML（先跳脫 HTML 再處理 markdown）
function markdownToHtml(md: string): string {
  return escapeHtml(md)
    .replace(/^### (.+)$/gm, '<h3 style="color: var(--accent-gold); font-size: 0.875rem; font-weight: 600; margin-top: 1.5rem; margin-bottom: 0.5rem;">$1</h3>')
    .replace(/^## (.+)$/gm, '<h2 style="color: var(--text-primary); font-size: 1rem; font-weight: 600; margin-bottom: 1rem;">$1</h2>')
    .replace(/^\- (.+)$/gm, '<li style="margin-left: 1rem; list-style: disc; margin-bottom: 0.25rem;">$1</li>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\n\n/g, '<br/><br/>')
}
