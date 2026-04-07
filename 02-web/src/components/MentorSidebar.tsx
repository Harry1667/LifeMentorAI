'use client'

import { useState, useEffect } from 'react'
import type { Persona } from '@/lib/types/persona'

interface MentorSidebarProps {
  activeMentorId: string
  activeSessionId: string | null
  onSelectMentor: (id: string) => void
  onSelectSession: (session: SessionSummary) => void
  onNewChat: () => void
  onDeleteSession: (sessionId: string) => void
  personas: Persona[]
  refreshKey?: number
}

export interface SessionSummary {
  id: string
  type: 'chat' | 'roundtable'
  title: string
  mentors: { name: string; color: string; initial: string }[]
  updatedAt: string
}

function MentorBadge({ persona, isActive }: { persona: Persona; isActive: boolean }) {
  return (
    <div
      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all cursor-pointer ${
        isActive
          ? 'bg-white/10 text-[var(--text-primary)]'
          : 'text-[var(--text-secondary)] hover:bg-white/5 hover:text-[var(--text-primary)]'
      }`}
    >
      <div
        className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold text-white shrink-0"
        style={{ backgroundColor: persona.color }}
      >
        {persona.initial}
      </div>
      <div className="text-left min-w-0">
        <div className="text-sm font-medium leading-tight">{persona.name}</div>
        <div className="text-xs opacity-60 truncate">{persona.archetype}</div>
      </div>
      {isActive && (
        <div
          className="w-1.5 h-1.5 rounded-full ml-auto shrink-0"
          style={{ backgroundColor: persona.color }}
        />
      )}
    </div>
  )
}

function formatDateGroup(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffDays === 0) return '今天'
  if (diffDays === 1) return '昨天'
  if (diffDays < 7) return `${diffDays} 天前`
  return date.toLocaleDateString('zh-TW', { month: 'short', day: 'numeric' })
}

export function MentorSidebar({
  activeMentorId,
  activeSessionId,
  onSelectMentor,
  onSelectSession,
  onNewChat,
  onDeleteSession,
  personas,
  refreshKey,
}: MentorSidebarProps) {
  const [sessions, setSessions] = useState<SessionSummary[]>([])
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/conversations/list')
      .then((r) => r.json())
      .then((data: SessionSummary[]) => setSessions(data))
      .catch(() => {})
  }, [refreshKey])

  // 按日期分群
  const grouped = sessions.reduce<Record<string, SessionSummary[]>>((acc, s) => {
    const group = formatDateGroup(s.updatedAt)
    if (!acc[group]) acc[group] = []
    acc[group].push(s)
    return acc
  }, {})

  function handleDelete(sessionId: string) {
    fetch('/api/conversations/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId }),
    })
      .then(() => {
        setSessions((prev) => prev.filter((s) => s.id !== sessionId))
        setDeleteConfirm(null)
        onDeleteSession(sessionId)
      })
      .catch(() => {})
  }

  return (
    <aside
      className="hidden md:flex flex-col w-60 shrink-0 border-r"
      style={{
        backgroundColor: 'var(--bg-sidebar)',
        borderColor: 'var(--border-subtle)',
      }}
    >
      {/* 品牌 */}
      <div className="px-4 py-4 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
        <h1 className="text-sm font-semibold tracking-wide" style={{ color: 'var(--accent-gold)' }}>
          Life Mentor AI
        </h1>
        <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
          你的私人圓桌智者
        </p>
      </div>

      {/* 導師列表 */}
      <div className="p-2 space-y-1">
        <p className="px-3 py-1 text-xs uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
          導師
        </p>
        {personas.map((persona) => (
          <div key={persona.id} onClick={() => onSelectMentor(persona.id)}>
            <MentorBadge persona={persona} isActive={activeMentorId === persona.id && !activeSessionId} />
          </div>
        ))}
      </div>

      {/* 分隔線 */}
      <div className="mx-3" style={{ borderTop: '1px solid var(--border-subtle)' }} />

      {/* 對話紀錄 */}
      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        <p className="px-3 py-1 text-xs uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
          對話紀錄
        </p>
        {sessions.length === 0 && (
          <p className="px-3 py-2 text-xs" style={{ color: 'var(--text-muted)' }}>
            還沒有對話紀錄
          </p>
        )}
        {Object.entries(grouped).map(([group, groupSessions]) => (
          <div key={group}>
            <p className="px-3 py-1 text-xs" style={{ color: 'var(--text-muted)' }}>
              {group}
            </p>
            {groupSessions.map((s) => (
              <div
                key={s.id}
                className={`group relative flex items-center gap-2 px-3 py-2 rounded-lg text-left transition-all cursor-pointer ${
                  activeSessionId === s.id ? 'bg-white/10' : 'hover:bg-white/5'
                }`}
                onClick={() => onSelectSession(s)}
              >
                {/* 導師頭像（多位導師疊加） */}
                <div className="flex -space-x-1.5 shrink-0">
                  {s.mentors.slice(0, 3).map((m, i) => (
                    <div
                      key={i}
                      className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white border border-[var(--bg-sidebar)]"
                      style={{ backgroundColor: m.color }}
                    >
                      {m.initial}
                    </div>
                  ))}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1">
                    {s.type === 'roundtable' && (
                      <span className="text-[10px] px-1 rounded" style={{ backgroundColor: 'var(--accent-gold)', color: 'white' }}>
                        圓桌
                      </span>
                    )}
                    <span className="text-xs truncate" style={{ color: 'var(--text-secondary)' }}>
                      {s.title}
                    </span>
                  </div>
                </div>

                {/* 刪除按鈕 */}
                {deleteConfirm === s.id ? (
                  <div className="flex gap-1 shrink-0">
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDelete(s.id) }}
                      className="text-[10px] px-1.5 py-0.5 rounded bg-red-600 text-white"
                    >
                      確認
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); setDeleteConfirm(null) }}
                      className="text-[10px] px-1.5 py-0.5 rounded"
                      style={{ color: 'var(--text-muted)' }}
                    >
                      取消
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={(e) => { e.stopPropagation(); setDeleteConfirm(s.id) }}
                    className="opacity-0 group-hover:opacity-100 transition-opacity text-xs shrink-0"
                    style={{ color: 'var(--text-muted)' }}
                    title="刪除對話"
                  >
                    ✕
                  </button>
                )}
              </div>
            ))}
          </div>
        ))}
      </div>

      {/* 底部 */}
      <div className="p-3 border-t space-y-2" style={{ borderColor: 'var(--border-subtle)' }}>
        <button
          onClick={onNewChat}
          className="w-full py-2 px-3 rounded-lg text-sm transition-colors hover:bg-white/5"
          style={{
            border: '1px solid var(--border-subtle)',
            color: 'var(--text-secondary)',
          }}
        >
          + 新對話
        </button>
        <a
          href="/actions"
          className="w-full py-2 px-3 rounded-lg text-sm flex items-center justify-center transition-opacity hover:opacity-70"
          style={{ color: 'var(--text-secondary)' }}
        >
          行動追蹤
        </a>
        <a
          href="/summary"
          className="w-full py-2 px-3 rounded-lg text-sm flex items-center justify-center transition-opacity hover:opacity-70"
          style={{ color: 'var(--text-secondary)' }}
        >
          每週摘要
        </a>
        <a
          href="/admin"
          className="w-full py-2 px-3 rounded-lg text-sm flex items-center justify-center transition-opacity hover:opacity-70"
          style={{ color: 'var(--accent-gold)' }}
        >
          管理導師 / 理論
        </a>
      </div>
    </aside>
  )
}

/** 手機版底部 Tab Bar */
export function MobileMentorTabs({ activeMentorId, onSelectMentor, personas }: {
  activeMentorId: string
  onSelectMentor: (id: string) => void
  personas: Persona[]
}) {
  return (
    <div
      className="md:hidden flex border-t"
      style={{
        backgroundColor: 'var(--bg-sidebar)',
        borderColor: 'var(--border-subtle)',
      }}
    >
      {personas.map((persona) => {
        const isActive = activeMentorId === persona.id
        return (
          <button
            key={persona.id}
            onClick={() => onSelectMentor(persona.id)}
            className="flex-1 flex flex-col items-center py-2.5 gap-1 transition-opacity"
            style={{ opacity: isActive ? 1 : 0.5 }}
          >
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white"
              style={{ backgroundColor: persona.color }}
            >
              {persona.initial}
            </div>
            <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
              {persona.name}
            </span>
          </button>
        )
      })}
    </div>
  )
}
