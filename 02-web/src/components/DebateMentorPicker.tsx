'use client'

import { useState, useEffect } from 'react'
import type { Persona } from '@/lib/types/persona'

interface TheoryOption {
  id: string
  name: string
  coreIdea: string
  category: string
}

interface DebateMentorPickerProps {
  personas: Persona[]
  onStart: (question: string, selectedMentors: Persona[], theoryIds: string[]) => void
  onCancel: () => void
  initialQuestion?: string
}

export function DebateMentorPicker({ personas, onStart, onCancel, initialQuestion = '' }: DebateMentorPickerProps) {
  const [question, setQuestion] = useState(initialQuestion)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    new Set(personas.slice(0, 3).map((p) => p.id))
  )
  const [theories, setTheories] = useState<TheoryOption[]>([])
  const [selectedTheoryIds, setSelectedTheoryIds] = useState<Set<string>>(new Set())

  // 載入理論列表
  useEffect(() => {
    fetch('/api/admin/theories')
      .then((r) => r.json())
      .then((data: TheoryOption[]) => setTheories(data))
      .catch(() => {})
  }, [])

  function toggleMentor(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleTheory(id: string) {
    setSelectedTheoryIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function handleStart() {
    const q = question.trim()
    if (!q || selectedIds.size < 2) return
    const selected = personas.filter((p) => selectedIds.has(p.id))
    onStart(q, selected, [...selectedTheoryIds])
  }

  // 按分類分組理論
  const groupedTheories = theories.reduce<Record<string, TheoryOption[]>>((acc, t) => {
    const cat = t.category || '其他'
    if (!acc[cat]) acc[cat] = []
    acc[cat].push(t)
    return acc
  }, {})

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div
        className="w-full max-w-lg mx-4 rounded-xl p-6 space-y-5 max-h-[85vh] overflow-y-auto"
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
                  <div className="min-w-0">
                    <span className="truncate block">{p.name}</span>
                    {p.category && (
                      <span className="text-[10px] block" style={{ color: 'var(--text-muted)' }}>{p.category}</span>
                    )}
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        {/* 理論選擇 */}
        {theories.length > 0 && (
          <div>
            <label className="text-xs block mb-2" style={{ color: 'var(--text-muted)' }}>
              加入理論框架（可選）
            </label>
            <div className="space-y-3">
              {Object.entries(groupedTheories).map(([category, items]) => (
                <div key={category}>
                  <span className="text-[10px] uppercase tracking-wider mb-1 block" style={{ color: 'var(--text-muted)' }}>
                    {category}
                  </span>
                  <div className="grid grid-cols-2 gap-1.5">
                    {items.map((t) => {
                      const selected = selectedTheoryIds.has(t.id)
                      return (
                        <button
                          key={t.id}
                          onClick={() => toggleTheory(t.id)}
                          className="flex flex-col px-3 py-2 rounded-lg text-left transition-all text-xs"
                          style={{
                            backgroundColor: selected ? 'rgba(217, 119, 6, 0.15)' : 'var(--bg-chat)',
                            border: `1px solid ${selected ? 'var(--accent-gold)' : 'var(--border-subtle)'}`,
                            color: selected ? 'var(--text-primary)' : 'var(--text-secondary)',
                          }}
                        >
                          <span className="font-medium">{t.name}</span>
                          <span className="text-[10px] line-clamp-1 mt-0.5" style={{ color: 'var(--text-muted)' }}>
                            {t.coreIdea}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

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
            開始辯論（{selectedIds.size} 位導師{selectedTheoryIds.size > 0 ? ` + ${selectedTheoryIds.size} 理論` : ''}）
          </button>
        </div>
      </div>
    </div>
  )
}
