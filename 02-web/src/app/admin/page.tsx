'use client'

import { useState, useEffect } from 'react'
import { UserButton } from '@clerk/nextjs'
import Link from 'next/link'
import type { Persona } from '@/lib/types/persona'
import type { TheoryRecord } from '@/lib/supabase/admin'
import { MentorDetailModal, TheoryDetailModal } from '@/components/DetailModal'

type Tab = 'mentor' | 'theory'

type TheoryInput = Omit<TheoryRecord, 'id' | 'createdAt'>

export default function AdminPage() {
  const [tab, setTab] = useState<Tab>('mentor')

  // Mentor state
  const [mentorInput, setMentorInput] = useState('')
  const [mentorPreview, setMentorPreview] = useState<Persona | null>(null)
  const [customPersonas, setCustomPersonas] = useState<Persona[]>([])

  // Theory state
  const [theoryInput, setTheoryInput] = useState('')
  const [theoryPreview, setTheoryPreview] = useState<TheoryInput | null>(null)
  const [theories, setTheories] = useState<TheoryRecord[]>([])

  const [analyzing, setAnalyzing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // 詳情彈窗
  const [detailMentor, setDetailMentor] = useState<Persona | null>(null)
  const [detailTheory, setDetailTheory] = useState<TheoryRecord | null>(null)

  useEffect(() => {
    fetch('/api/admin/personas').then((r) => r.json()).then(setCustomPersonas).catch(() => {})
    fetch('/api/admin/theories').then((r) => r.json()).then(setTheories).catch(() => {})
  }, [])

  async function analyze(type: Tab) {
    const name = type === 'mentor' ? mentorInput : theoryInput
    if (!name.trim()) return
    setAnalyzing(true)
    setError('')
    try {
      const res = await fetch('/api/admin/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, name }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'AI 分析失敗')
      if (type === 'mentor') setMentorPreview(data)
      else setTheoryPreview(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'AI 分析失敗，請重試')
    } finally {
      setAnalyzing(false)
    }
  }

  async function saveMentor() {
    if (!mentorPreview) return
    setSaving(true)
    try {
      await fetch('/api/admin/personas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(mentorPreview),
      })
      setCustomPersonas((prev) => {
        const filtered = prev.filter((p) => p.id !== mentorPreview.id)
        return [...filtered, mentorPreview]
      })
      setMentorPreview(null)
      setMentorInput('')
    } finally {
      setSaving(false)
    }
  }

  async function deleteMentor(id: string) {
    await fetch('/api/admin/personas', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    setCustomPersonas((prev) => prev.filter((p) => p.id !== id))
  }

  async function saveTheory() {
    if (!theoryPreview) return
    setSaving(true)
    try {
      await fetch('/api/admin/theories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(theoryPreview),
      })
      // refetch to get id
      const updated = await fetch('/api/admin/theories').then((r) => r.json())
      setTheories(updated)
      setTheoryPreview(null)
      setTheoryInput('')
    } finally {
      setSaving(false)
    }
  }

  async function deleteTheory(id: string) {
    await fetch('/api/admin/theories', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    setTheories((prev) => prev.filter((t) => t.id !== id))
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)' }}>
      {/* Header */}
      <header
        className="flex items-center justify-between px-6 py-4 border-b"
        style={{ borderColor: 'var(--border-subtle)', backgroundColor: 'var(--bg-sidebar)' }}
      >
        <div className="flex items-center gap-4">
          <Link href="/chat" className="text-sm transition-opacity hover:opacity-70" style={{ color: 'var(--text-secondary)' }}>
            ← 返回聊天
          </Link>
          <span style={{ color: 'var(--border-subtle)' }}>|</span>
          <h1 className="text-sm font-semibold" style={{ color: 'var(--accent-gold)' }}>
            管理後台
          </h1>
        </div>
        <UserButton />
      </header>

      <div className="max-w-3xl mx-auto px-6 py-8">
        {/* Tabs */}
        <div className="flex gap-1 mb-8 p-1 rounded-lg w-fit" style={{ backgroundColor: 'var(--bg-bubble-mentor)' }}>
          {(['mentor', 'theory'] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => { setTab(t); setError('') }}
              className="px-5 py-2 rounded-md text-sm font-medium transition-all"
              style={
                tab === t
                  ? { backgroundColor: 'var(--accent-gold)', color: '#000' }
                  : { color: 'var(--text-secondary)' }
              }
            >
              {t === 'mentor' ? '導師' : '理論'}
            </button>
          ))}
        </div>

        {/* Error */}
        {error && (
          <p className="mb-4 text-sm px-4 py-2 rounded-lg" style={{ backgroundColor: '#450a0a', color: '#fca5a5' }}>
            {error}
          </p>
        )}

        {/* ── MENTOR TAB ── */}
        {tab === 'mentor' && (
          <div className="space-y-6">
            {/* Input */}
            <div
              className="rounded-xl p-5 space-y-4"
              style={{ backgroundColor: 'var(--bg-bubble-mentor)', border: '1px solid var(--border-subtle)' }}
            >
              <h2 className="text-sm font-semibold" style={{ color: 'var(--text-secondary)' }}>新增導師</h2>
              <div className="flex gap-3">
                <input
                  value={mentorInput}
                  onChange={(e) => setMentorInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && analyze('mentor')}
                  placeholder="輸入人名，例如：孔子、尼采、馬克·吐溫"
                  className="flex-1 px-4 py-2.5 rounded-lg text-sm outline-none"
                  style={{
                    backgroundColor: 'var(--bg-chat)',
                    color: 'var(--text-primary)',
                    border: '1px solid var(--border-subtle)',
                  }}
                />
                <button
                  onClick={() => analyze('mentor')}
                  disabled={analyzing || !mentorInput.trim()}
                  className="px-4 py-2.5 rounded-lg text-sm font-medium transition-opacity disabled:opacity-40"
                  style={{ backgroundColor: 'var(--accent-gold)', color: '#000' }}
                >
                  {analyzing ? '分析中...' : 'AI 分析'}
                </button>
              </div>
            </div>

            {/* Mentor Preview */}
            {mentorPreview && (
              <div
                className="rounded-xl p-5 space-y-4"
                style={{ backgroundColor: 'var(--bg-bubble-mentor)', border: `2px solid ${mentorPreview.color}` }}
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center text-lg font-bold text-white shrink-0"
                    style={{ backgroundColor: mentorPreview.color }}
                  >
                    {mentorPreview.initial}
                  </div>
                  <div>
                    <div className="font-semibold">{mentorPreview.name}</div>
                    <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>{mentorPreview.fullName}</div>
                  </div>
                  <div className="ml-auto flex items-center gap-2">
                    <label className="text-xs" style={{ color: 'var(--text-secondary)' }}>代表色</label>
                    <input
                      type="color"
                      value={mentorPreview.color}
                      onChange={(e) => setMentorPreview({ ...mentorPreview, color: e.target.value })}
                      className="w-8 h-8 rounded cursor-pointer border-0"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 text-sm">
                  <Field label="定位" value={mentorPreview.archetype}
                    onChange={(v) => setMentorPreview({ ...mentorPreview, archetype: v })} />
                  <Field label="擅長領域" value={mentorPreview.domain}
                    onChange={(v) => setMentorPreview({ ...mentorPreview, domain: v })} />
                </div>

                <Field label="開場白" value={mentorPreview.greeting}
                  onChange={(v) => setMentorPreview({ ...mentorPreview, greeting: v })} />

                <div>
                  <label className="text-xs mb-1 block" style={{ color: 'var(--text-secondary)' }}>分類</label>
                  <select
                    value={mentorPreview.category || '其他'}
                    onChange={(e) => setMentorPreview({ ...mentorPreview, category: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                    style={{
                      backgroundColor: 'var(--bg-chat)',
                      color: 'var(--text-primary)',
                      border: '1px solid var(--border-subtle)',
                    }}
                  >
                    {['管理學', '心理學', '哲學', '科學', '經濟學', '行為學', '創業', '藝術', '教育', '其他'].map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs mb-1 block" style={{ color: 'var(--text-secondary)' }}>
                    System Prompt
                    <span className="ml-2 text-[10px]" style={{ color: 'var(--text-muted)' }}>
                      （遵守 6 區塊架構：身份定位 → 心智模型 → 決策啟發法 → 表達 DNA → 內在矛盾 → 已知局限。詳見 src/lib/personas/PERSONA_FRAMEWORK.md）
                    </span>
                  </label>
                  <textarea
                    value={mentorPreview.systemPrompt}
                    onChange={(e) => setMentorPreview({ ...mentorPreview, systemPrompt: e.target.value })}
                    rows={16}
                    className="w-full px-3 py-2 rounded-lg text-xs outline-none resize-y"
                    style={{
                      backgroundColor: 'var(--bg-chat)',
                      color: 'var(--text-primary)',
                      border: '1px solid var(--border-subtle)',
                    }}
                  />
                </div>

                <button
                  onClick={saveMentor}
                  disabled={saving}
                  className="w-full py-2.5 rounded-lg text-sm font-semibold transition-opacity disabled:opacity-40"
                  style={{ backgroundColor: mentorPreview.color, color: '#fff' }}
                >
                  {saving ? '新增中...' : '+ 新增導師'}
                </button>
              </div>
            )}

            {/* Existing custom personas */}
            {customPersonas.length > 0 && (
              <div>
                <h2 className="text-xs uppercase tracking-wider mb-3" style={{ color: 'var(--text-muted)' }}>
                  已新增的自訂導師
                </h2>
                <div className="space-y-2">
                  {customPersonas.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => setDetailMentor(p)}
                      className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-colors hover:bg-white/5"
                      style={{ backgroundColor: 'var(--bg-bubble-mentor)', border: '1px solid var(--border-subtle)' }}
                      title="點擊查看詳情"
                    >
                      <div
                        className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
                        style={{ backgroundColor: p.color }}
                      >
                        {p.initial}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">{p.name}</span>
                          {p.category && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ backgroundColor: 'var(--bg-chat)', color: 'var(--text-muted)' }}>
                              {p.category}
                            </span>
                          )}
                        </div>
                        <div className="text-xs truncate" style={{ color: 'var(--text-secondary)' }}>{p.archetype}</div>
                      </div>
                      <span
                        onClick={(e) => { e.stopPropagation(); deleteMentor(p.id) }}
                        role="button"
                        tabIndex={0}
                        className="text-xs px-3 py-1 rounded transition-opacity hover:opacity-70 cursor-pointer"
                        style={{ color: '#ef4444', border: '1px solid #ef4444' }}
                      >
                        刪除
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── THEORY TAB ── */}
        {tab === 'theory' && (
          <div className="space-y-6">
            {/* Input */}
            <div
              className="rounded-xl p-5 space-y-4"
              style={{ backgroundColor: 'var(--bg-bubble-mentor)', border: '1px solid var(--border-subtle)' }}
            >
              <h2 className="text-sm font-semibold" style={{ color: 'var(--text-secondary)' }}>新增理論</h2>
              <div className="flex gap-3">
                <input
                  value={theoryInput}
                  onChange={(e) => setTheoryInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && analyze('theory')}
                  placeholder="輸入理論名稱，例如：番茄鐘工作法、斯多葛主義、第一性原理"
                  className="flex-1 px-4 py-2.5 rounded-lg text-sm outline-none"
                  style={{
                    backgroundColor: 'var(--bg-chat)',
                    color: 'var(--text-primary)',
                    border: '1px solid var(--border-subtle)',
                  }}
                />
                <button
                  onClick={() => analyze('theory')}
                  disabled={analyzing || !theoryInput.trim()}
                  className="px-4 py-2.5 rounded-lg text-sm font-medium transition-opacity disabled:opacity-40"
                  style={{ backgroundColor: 'var(--accent-gold)', color: '#000' }}
                >
                  {analyzing ? '分析中...' : 'AI 分析'}
                </button>
              </div>
            </div>

            {/* Theory Preview */}
            {theoryPreview && (
              <div
                className="rounded-xl p-5 space-y-4"
                style={{ backgroundColor: 'var(--bg-bubble-mentor)', border: '1px solid var(--accent-gold)' }}
              >
                <div>
                  <div className="text-lg font-semibold" style={{ color: 'var(--accent-gold)' }}>
                    {theoryPreview.name}
                  </div>
                </div>

                <Field label="核心思想" value={theoryPreview.coreIdea}
                  onChange={(v) => setTheoryPreview({ ...theoryPreview, coreIdea: v })} />

                <div>
                  <label className="text-xs mb-2 block" style={{ color: 'var(--text-secondary)' }}>主要原則</label>
                  <div className="space-y-2">
                    {theoryPreview.keyPrinciples.map((p, i) => (
                      <div key={i} className="flex items-start gap-2">
                        <span className="text-xs mt-2 shrink-0" style={{ color: 'var(--accent-gold)' }}>{i + 1}.</span>
                        <input
                          value={p}
                          onChange={(e) => {
                            const updated = [...theoryPreview.keyPrinciples]
                            updated[i] = e.target.value
                            setTheoryPreview({ ...theoryPreview, keyPrinciples: updated })
                          }}
                          className="flex-1 px-3 py-1.5 rounded text-sm outline-none"
                          style={{
                            backgroundColor: 'var(--bg-chat)',
                            color: 'var(--text-primary)',
                            border: '1px solid var(--border-subtle)',
                          }}
                        />
                      </div>
                    ))}
                  </div>
                </div>

                <Field label="適用場景" value={theoryPreview.application}
                  onChange={(v) => setTheoryPreview({ ...theoryPreview, application: v })} />

                <div>
                  <label className="text-xs mb-1 block" style={{ color: 'var(--text-secondary)' }}>導師使用指令</label>
                  <textarea
                    value={theoryPreview.systemPromptExtension}
                    onChange={(e) => setTheoryPreview({ ...theoryPreview, systemPromptExtension: e.target.value })}
                    rows={4}
                    className="w-full px-3 py-2 rounded-lg text-xs outline-none resize-y"
                    style={{
                      backgroundColor: 'var(--bg-chat)',
                      color: 'var(--text-primary)',
                      border: '1px solid var(--border-subtle)',
                    }}
                  />
                </div>

                <button
                  onClick={saveTheory}
                  disabled={saving}
                  className="w-full py-2.5 rounded-lg text-sm font-semibold transition-opacity disabled:opacity-40"
                  style={{ backgroundColor: 'var(--accent-gold)', color: '#000' }}
                >
                  {saving ? '新增中...' : '+ 新增理論'}
                </button>
              </div>
            )}

            {/* Existing theories */}
            {theories.length > 0 && (
              <div>
                <h2 className="text-xs uppercase tracking-wider mb-3" style={{ color: 'var(--text-muted)' }}>
                  已新增的理論
                </h2>
                <div className="space-y-2">
                  {theories.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => setDetailTheory(t)}
                      className="w-full px-4 py-3 rounded-lg text-left transition-colors hover:bg-white/5"
                      style={{ backgroundColor: 'var(--bg-bubble-mentor)', border: '1px solid var(--border-subtle)' }}
                      title="點擊查看詳情"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium" style={{ color: 'var(--accent-gold)' }}>{t.name}</span>
                            {t.category && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ backgroundColor: 'var(--bg-chat)', color: 'var(--text-muted)' }}>
                                {t.category}
                              </span>
                            )}
                          </div>
                          <div className="text-xs mt-1 line-clamp-2" style={{ color: 'var(--text-secondary)' }}>{t.coreIdea}</div>
                          {Array.isArray(t.keyPrinciples) && t.keyPrinciples.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-2">
                              {t.keyPrinciples.slice(0, 3).map((p, i) => (
                                <span
                                  key={i}
                                  className="text-xs px-2 py-0.5 rounded"
                                  style={{ backgroundColor: 'var(--bg-chat)', color: 'var(--text-muted)' }}
                                >
                                  {p.length > 20 ? p.slice(0, 20) + '…' : p}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                        <span
                          onClick={(e) => { e.stopPropagation(); deleteTheory(t.id) }}
                          role="button"
                          tabIndex={0}
                          className="text-xs px-3 py-1 rounded shrink-0 transition-opacity hover:opacity-70 cursor-pointer"
                          style={{ color: '#ef4444', border: '1px solid #ef4444' }}
                        >
                          刪除
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 詳情彈窗 */}
      {detailMentor && (
        <MentorDetailModal mentor={detailMentor} onClose={() => setDetailMentor(null)} />
      )}
      {detailTheory && (
        <TheoryDetailModal theory={detailTheory} onClose={() => setDetailTheory(null)} />
      )}
    </div>
  )
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (v: string) => void
}) {
  return (
    <div>
      <label className="text-xs mb-1 block" style={{ color: 'var(--text-secondary)' }}>{label}</label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2 rounded-lg text-sm outline-none"
        style={{
          backgroundColor: 'var(--bg-chat)',
          color: 'var(--text-primary)',
          border: '1px solid var(--border-subtle)',
        }}
      />
    </div>
  )
}
