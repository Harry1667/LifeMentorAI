'use client'

import { useState } from 'react'

interface ActionSuggestionProps {
  advice: string
  mentorSource: string
  accentColor?: string
}

export function ActionSuggestion({ advice, mentorSource, accentColor = 'var(--accent-gold)' }: ActionSuggestionProps) {
  const [state, setState] = useState<'pending' | 'accepted' | 'dismissed'>('pending')

  async function handleAccept() {
    setState('accepted')
    await fetch('/api/actions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ adviceText: advice, mentorSource }),
    })
  }

  if (state === 'accepted') {
    return (
      <div className="ml-11 mt-2 px-3 py-2 rounded-lg text-xs" style={{ color: 'var(--text-muted)' }}>
        已加入行動追蹤
      </div>
    )
  }

  if (state === 'dismissed') return null

  return (
    <div
      className="ml-11 mt-2 rounded-lg px-4 py-3"
      style={{ backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border-subtle)' }}
    >
      <p className="text-xs mb-2" style={{ color: 'var(--text-muted)' }}>
        {mentorSource} 建議的行動：
      </p>
      <p className="text-sm mb-3 leading-relaxed" style={{ color: 'var(--text-primary)' }}>
        {advice}
      </p>
      <div className="flex gap-2">
        <button
          onClick={handleAccept}
          className="text-xs px-3 py-1.5 rounded-lg text-white transition-opacity hover:opacity-90"
          style={{ backgroundColor: accentColor }}
        >
          接受
        </button>
        <button
          onClick={() => setState('dismissed')}
          className="text-xs px-3 py-1.5 rounded-lg transition-opacity hover:opacity-70"
          style={{ color: 'var(--text-muted)', border: '1px solid var(--border-subtle)' }}
        >
          以後再說
        </button>
      </div>
    </div>
  )
}
