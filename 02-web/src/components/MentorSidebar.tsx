'use client'

import { useState, useEffect } from 'react'

interface SidebarProps {
  activeSessionId: string | null
  onSelectSession: (session: SessionSummary) => void
  onNewChat: () => void
  onNewRoundtable: () => void
  onDeleteSession: (sessionId: string) => void
  collapsed: boolean
  onToggle: () => void
  refreshKey?: number
}

export interface SessionSummary {
  id: string
  type: 'chat' | 'roundtable'
  title: string
  mentors: { name: string; color: string; initial: string }[]
  updatedAt: string
}

function formatDateGroup(dateStr: string): string {
  const tz = 'Asia/Taipei'
  const date = new Date(dateStr)
  const now = new Date()
  // 用台灣時區的日期字串比較，避免 UTC 跨日誤判
  const toDateStr = (d: Date) => d.toLocaleDateString('en-CA', { timeZone: tz })
  const dateOnly = toDateStr(date)
  const todayStr = toDateStr(now)
  const yesterdayStr = toDateStr(new Date(now.getTime() - 86400000))
  if (dateOnly === todayStr) return '今天'
  if (dateOnly === yesterdayStr) return '昨天'
  const diffDays = Math.floor((now.getTime() - date.getTime()) / 86400000)
  if (diffDays < 7) return `${diffDays} 天前`
  return date.toLocaleDateString('zh-TW', { month: 'short', day: 'numeric', timeZone: tz })
}

export function Sidebar({
  activeSessionId,
  onSelectSession,
  onNewChat,
  onNewRoundtable,
  onDeleteSession,
  collapsed,
  onToggle,
  refreshKey,
}: SidebarProps) {
  const [sessions, setSessions] = useState<SessionSummary[]>([])
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const [showNewMenu, setShowNewMenu] = useState(false)

  useEffect(() => {
    fetch('/api/conversations/list')
      .then((r) => r.json())
      .then((data: SessionSummary[]) => setSessions(data))
      .catch(() => {})
  }, [refreshKey])

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
    }).then(() => {
      setSessions((prev) => prev.filter((s) => s.id !== sessionId))
      setDeleteConfirm(null)
      onDeleteSession(sessionId)
    }).catch(() => {})
  }

  // 收合狀態：只顯示漢堡按鈕
  if (collapsed) {
    return (
      <aside className="hidden md:flex flex-col w-12 shrink-0 items-center py-3 border-r"
        style={{ backgroundColor: 'var(--bg-sidebar)', borderColor: 'var(--border-subtle)' }}>
        <button onClick={onToggle} className="p-2 rounded-lg hover:bg-white/5 transition-colors" style={{ color: 'var(--text-secondary)' }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 6h18M3 12h18M3 18h18" />
          </svg>
        </button>
      </aside>
    )
  }

  return (
    <aside
      className="hidden md:flex flex-col w-64 shrink-0 border-r"
      style={{ backgroundColor: 'var(--bg-sidebar)', borderColor: 'var(--border-subtle)' }}
    >
      {/* 頂部 */}
      <div className="flex items-center justify-between px-3 py-3">
        <button onClick={onToggle} className="p-2 rounded-lg hover:bg-white/5 transition-colors" style={{ color: 'var(--text-secondary)' }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 6h18M3 12h18M3 18h18" />
          </svg>
        </button>
        <div className="relative">
          <button
            onClick={() => setShowNewMenu((v) => !v)}
            className="p-2 rounded-lg hover:bg-white/5 transition-colors"
            style={{ color: 'var(--text-secondary)' }}
            title="新對話"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 5v14M5 12h14" />
            </svg>
          </button>

          {showNewMenu && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setShowNewMenu(false)} />
              <div
                className="absolute left-0 top-full mt-1 w-44 rounded-xl py-1 z-50 shadow-lg"
                style={{ backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border-subtle)' }}
              >
                <button
                  onClick={() => { setShowNewMenu(false); onNewChat() }}
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left text-sm hover:bg-white/5 transition-colors"
                  style={{ color: 'var(--text-primary)' }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
                  </svg>
                  新對話
                </button>
                <button
                  onClick={() => { setShowNewMenu(false); onNewRoundtable() }}
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left text-sm hover:bg-white/5 transition-colors"
                  style={{ color: 'var(--accent-gold)' }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <circle cx="12" cy="12" r="10" />
                    <circle cx="12" cy="8" r="2" />
                    <circle cx="7" cy="14" r="2" />
                    <circle cx="17" cy="14" r="2" />
                  </svg>
                  圓桌群聊
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* 對話紀錄 */}
      <div className="flex-1 overflow-y-auto px-2 space-y-1">
        {sessions.length === 0 && (
          <p className="px-3 py-4 text-xs text-center" style={{ color: 'var(--text-muted)' }}>
            還沒有對話紀錄
          </p>
        )}
        {Object.entries(grouped).map(([group, groupSessions]) => (
          <div key={group}>
            <p className="px-3 py-1.5 text-xs" style={{ color: 'var(--text-muted)' }}>
              {group}
            </p>
            {groupSessions.map((s) => (
              <div
                key={s.id}
                className={`group relative flex items-center gap-2 px-3 py-2.5 rounded-lg cursor-pointer transition-all ${
                  activeSessionId === s.id ? 'bg-white/10' : 'hover:bg-white/5'
                }`}
                onClick={() => onSelectSession(s)}
              >
                {/* 導師頭像 */}
                <div className="flex -space-x-1 shrink-0">
                  {s.mentors.slice(0, 2).map((m, i) => (
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
                  {s.type === 'roundtable' && (
                    <div className="flex items-center gap-1 mb-0.5">
                      <span className="text-[9px] px-1 py-0.5 rounded shrink-0" style={{ backgroundColor: 'var(--accent-gold)', color: 'white' }}>
                        圓桌
                      </span>
                      <span className="text-[10px] truncate" style={{ color: 'var(--text-muted)' }}>
                        {s.mentors.map((m) => m.name).join('、')}
                      </span>
                    </div>
                  )}
                  {s.type === 'chat' && s.mentors[0] && (
                    <span className="text-[10px] block mb-0.5" style={{ color: 'var(--text-muted)' }}>
                      {s.mentors[0].name}
                    </span>
                  )}
                  <span className="text-xs truncate block" style={{ color: 'var(--text-primary)' }}>
                    {s.title}
                  </span>
                </div>

                {/* 刪除 */}
                {deleteConfirm === s.id ? (
                  <div className="flex gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                    <button onClick={() => handleDelete(s.id)} className="text-[10px] px-1.5 py-0.5 rounded bg-red-600 text-white">確認</button>
                    <button onClick={() => setDeleteConfirm(null)} className="text-[10px] px-1.5 py-0.5 rounded" style={{ color: 'var(--text-muted)' }}>取消</button>
                  </div>
                ) : (
                  <button
                    onClick={(e) => { e.stopPropagation(); setDeleteConfirm(s.id) }}
                    className="opacity-0 group-hover:opacity-100 transition-opacity text-xs shrink-0"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    ✕
                  </button>
                )}
              </div>
            ))}
          </div>
        ))}
      </div>

      {/* 底部連結 */}
      <div className="px-3 py-3 border-t space-y-1" style={{ borderColor: 'var(--border-subtle)' }}>
        <a href="/actions" className="block px-3 py-2 rounded-lg text-xs hover:bg-white/5 transition-colors" style={{ color: 'var(--text-secondary)' }}>
          行動追蹤
        </a>
        <a href="/summary" className="block px-3 py-2 rounded-lg text-xs hover:bg-white/5 transition-colors" style={{ color: 'var(--text-secondary)' }}>
          每週摘要
        </a>
        <a href="/admin" className="block px-3 py-2 rounded-lg text-xs hover:bg-white/5 transition-colors" style={{ color: 'var(--accent-gold)' }}>
          管理導師 / 理論
        </a>
      </div>
    </aside>
  )
}

/** 手機版底部選單（簡化） */
export function MobileNav() {
  return (
    <div
      className="md:hidden flex border-t"
      style={{ backgroundColor: 'var(--bg-sidebar)', borderColor: 'var(--border-subtle)' }}
    >
      <a href="/chat" className="flex-1 flex flex-col items-center py-2.5 gap-0.5" style={{ color: 'var(--accent-gold)' }}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" /></svg>
        <span className="text-[10px]">對話</span>
      </a>
      <a href="/actions" className="flex-1 flex flex-col items-center py-2.5 gap-0.5" style={{ color: 'var(--text-secondary)' }}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 11l3 3L22 4M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" /></svg>
        <span className="text-[10px]">行動</span>
      </a>
      <a href="/summary" className="flex-1 flex flex-col items-center py-2.5 gap-0.5" style={{ color: 'var(--text-secondary)' }}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 6h16M4 12h16M4 18h10" /></svg>
        <span className="text-[10px]">摘要</span>
      </a>
    </div>
  )
}
