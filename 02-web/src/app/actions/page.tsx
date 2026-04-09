'use client'

import { useState, useEffect } from 'react'
import { UserButton } from '@clerk/nextjs'
import Link from 'next/link'

interface Action {
  id: string
  advice_text: string
  status: 'accepted' | 'in_progress' | 'rejected' | 'completed'
  progress_pct: number
  rejection_reason: string | null
  mentor_source: string | null
  created_at: string
  updated_at: string
}

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  accepted:    { label: '已接受', color: '#d97706' },
  in_progress: { label: '進行中', color: '#2563eb' },
  completed:   { label: '已完成', color: '#16a34a' },
  rejected:    { label: '已拒絕', color: '#71717a' },
}

export default function ActionsPage() {
  const [actions, setActions] = useState<Action[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/actions')
      .then((r) => r.json())
      .then((data) => { setActions(data); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  async function updateAction(id: string, updates: Record<string, unknown>) {
    await fetch('/api/actions', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, ...updates }),
    })
    setActions((prev) => prev.map((a) => a.id === id ? { ...a, ...updates } as Action : a))
  }

  async function deleteAction(id: string) {
    await fetch('/api/actions', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    setActions((prev) => prev.filter((a) => a.id !== id))
  }

  // 按狀態分群
  const groups = ['in_progress', 'accepted', 'completed', 'rejected'] as const
  const grouped = groups.map((status) => ({
    status,
    ...STATUS_CONFIG[status],
    items: actions.filter((a) => a.status === status),
  }))

  // 統計
  const total = actions.length
  const completed = actions.filter((a) => a.status === 'completed').length
  const inProgress = actions.filter((a) => a.status === 'in_progress').length

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)' }}>
      {/* Header */}
      <header
        className="flex items-center justify-between px-6 py-4 border-b"
        style={{ borderColor: 'var(--border-subtle)' }}
      >
        <div>
          <h1 className="text-lg font-semibold" style={{ color: 'var(--accent-gold)' }}>
            行動追蹤
          </h1>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
            {total} 項行動 · {completed} 完成 · {inProgress} 進行中
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

      {/* 看板 */}
      <div className="p-6">
        {loading ? (
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>載入中...</p>
        ) : actions.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-base" style={{ color: 'var(--text-secondary)' }}>
              還沒有行動紀錄
            </p>
            <p className="text-sm mt-2" style={{ color: 'var(--text-muted)' }}>
              和導師對話後，接受導師的建議就會出現在這裡
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {grouped.map((group) => (
              <div key={group.status}>
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: group.color }} />
                  <span className="text-sm font-medium" style={{ color: group.color }}>
                    {group.label}
                  </span>
                  <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    {group.items.length}
                  </span>
                </div>
                <div className="space-y-2">
                  {group.items.map((action) => (
                    <ActionCard
                      key={action.id}
                      action={action}
                      onUpdate={updateAction}
                      onDelete={deleteAction}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function ActionCard({
  action,
  onUpdate,
  onDelete,
}: {
  action: Action
  onUpdate: (id: string, updates: Record<string, unknown>) => void
  onDelete: (id: string) => void
}) {
  const config = STATUS_CONFIG[action.status]

  return (
    <div
      className="relative rounded-lg p-3 text-sm"
      style={{ backgroundColor: 'var(--bg-chat)', border: '1px solid var(--border-subtle)' }}
    >
      {/* 建議文字 */}
      <p className="leading-relaxed mb-2" style={{ color: 'var(--text-primary)' }}>
        {action.advice_text}
      </p>

      {/* 來源導師 */}
      {action.mentor_source && (
        <p className="text-xs mb-2" style={{ color: 'var(--text-muted)' }}>
          來自 {action.mentor_source}
        </p>
      )}

      {/* 進度條（進行中時顯示） */}
      {action.status === 'in_progress' && (
        <div className="mb-2">
          <div className="flex items-center justify-between text-xs mb-1">
            <span style={{ color: 'var(--text-muted)' }}>進度</span>
            <span style={{ color: config.color }}>{action.progress_pct}%</span>
          </div>
          <div className="w-full h-1.5 rounded-full" style={{ backgroundColor: 'var(--border-subtle)' }}>
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${action.progress_pct}%`, backgroundColor: config.color }}
            />
          </div>
          <input
            type="range"
            min={0}
            max={100}
            step={10}
            value={action.progress_pct}
            onChange={(e) => {
              const pct = Number(e.target.value)
              onUpdate(action.id, {
                progressPct: pct,
                status: pct >= 100 ? 'completed' : 'in_progress',
                progress_pct: pct,
              })
            }}
            className="w-full mt-1 accent-[var(--accent-gold)]"
          />
        </div>
      )}

      {/* 操作按鈕 */}
      <div className="flex items-center gap-1.5 flex-wrap">
        {action.status === 'accepted' && (
          <>
            <button
              onClick={() => onUpdate(action.id, { status: 'in_progress', progress_pct: 0 })}
              className="text-xs px-2 py-1 rounded transition-opacity hover:opacity-80"
              style={{ backgroundColor: '#2563eb', color: 'white' }}
            >
              開始執行
            </button>
            <button
              onClick={() => onUpdate(action.id, { status: 'rejected' })}
              className="text-xs px-2 py-1 rounded transition-opacity hover:opacity-80"
              style={{ color: 'var(--text-muted)', border: '1px solid var(--border-subtle)' }}
            >
              拒絕
            </button>
          </>
        )}
        {action.status === 'in_progress' && (
          <button
            onClick={() => onUpdate(action.id, { status: 'completed', progressPct: 100, progress_pct: 100 })}
            className="text-xs px-2 py-1 rounded transition-opacity hover:opacity-80"
            style={{ backgroundColor: '#16a34a', color: 'white' }}
          >
            標記完成
          </button>
        )}
        {(action.status === 'completed' || action.status === 'rejected') && (
          <button
            onClick={() => onDelete(action.id)}
            className="text-xs px-2 py-1 rounded transition-opacity hover:opacity-80"
            style={{ color: 'var(--text-muted)' }}
          >
            刪除
          </button>
        )}
      </div>

      {/* 日期 */}
      <p className="text-[10px] mt-2" style={{ color: 'var(--text-muted)' }}>
        {new Date(action.created_at).toLocaleDateString('zh-TW', { month: 'short', day: 'numeric', timeZone: 'Asia/Taipei' })}
      </p>
    </div>
  )
}
