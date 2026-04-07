'use client'

import { useState } from 'react'
import type { Persona } from '@/lib/types/persona'

interface DebateMentorPickerProps {
  personas: Persona[]
  onStart: (question: string, selectedMentors: Persona[]) => void
  onCancel: () => void
  initialQuestion?: string
}

export function DebateMentorPicker({ personas, onStart, onCancel, initialQuestion = '' }: DebateMentorPickerProps) {
  const [question, setQuestion] = useState(initialQuestion)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    new Set(personas.slice(0, 3).map((p) => p.id))
  )

  function toggleMentor(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  function handleStart() {
    const q = question.trim()
    if (!q || selectedIds.size < 2) return
    const selected = personas.filter((p) => selectedIds.has(p.id))
    onStart(q, selected)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div
        className="w-full max-w-md mx-4 rounded-xl p-6 space-y-5"
        style={{ backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border-subtle)' }}
      >
        <h2 className="text-base font-medium" style={{ color: 'var(--accent-gold)' }}>
          圓桌辯論
        </h2>

        {/* 問題輸入 */}
        <div>
          <label className="text-xs block mb-1.5" style={{ color: 'var(--text-muted)' }}>
            你的問題
          </label>
          <textarea
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="輸入你想讓導師們辯論的問題..."
            rows={3}
            className="w-full rounded-lg px-3 py-2 text-sm resize-none outline-none"
            style={{
              backgroundColor: 'var(--bg-chat)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border-subtle)',
            }}
            autoFocus
          />
        </div>

        {/* 導師選擇 */}
        <div>
          <label className="text-xs block mb-2" style={{ color: 'var(--text-muted)' }}>
            選擇導師（至少 2 位）
          </label>
          <div className="grid grid-cols-2 gap-2">
            {personas.map((p) => {
              const selected = selectedIds.has(p.id)
              return (
                <button
                  key={p.id}
                  onClick={() => toggleMentor(p.id)}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg text-left transition-all text-sm"
                  style={{
                    backgroundColor: selected ? `${p.color}30` : 'var(--bg-chat)',
                    border: `1px solid ${selected ? p.color : 'var(--border-subtle)'}`,
                    color: selected ? 'var(--text-primary)' : 'var(--text-secondary)',
                  }}
                >
                  <div
                    className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
                    style={{ backgroundColor: p.color, opacity: selected ? 1 : 0.4 }}
                  >
                    {p.initial}
                  </div>
                  <span className="truncate">{p.name}</span>
                </button>
              )
            })}
          </div>
        </div>

        {/* 按鈕 */}
        <div className="flex justify-end gap-2 pt-2">
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded-lg text-sm transition-opacity hover:opacity-70"
            style={{ color: 'var(--text-muted)' }}
          >
            取消
          </button>
          <button
            onClick={handleStart}
            disabled={!question.trim() || selectedIds.size < 2}
            className="px-4 py-2 rounded-lg text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-30"
            style={{ backgroundColor: 'var(--accent-gold)' }}
          >
            開始辯論（{selectedIds.size} 位導師）
          </button>
        </div>
      </div>
    </div>
  )
}
