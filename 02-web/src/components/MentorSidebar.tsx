'use client'

import { PERSONAS } from '@/lib/personas'
import type { Persona } from '@/lib/types/persona'

interface MentorSidebarProps {
  activeMentorId: string
  onSelectMentor: (id: string) => void
}

function MentorBadge({ persona, isActive }: { persona: Persona; isActive: boolean }) {
  return (
    <button
      onClick={() => {}}
      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all ${
        isActive
          ? 'bg-white/10 text-[var(--text-primary)]'
          : 'text-[var(--text-secondary)] hover:bg-white/5 hover:text-[var(--text-primary)]'
      }`}
    >
      {/* 字母縮寫徽章 */}
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
    </button>
  )
}

export function MentorSidebar({ activeMentorId, onSelectMentor }: MentorSidebarProps) {
  return (
    <aside
      className="hidden md:flex flex-col w-56 shrink-0 border-r"
      style={{
        backgroundColor: 'var(--bg-sidebar)',
        borderColor: 'var(--border-subtle)',
      }}
    >
      {/* 品牌 */}
      <div className="px-4 py-5 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
        <h1 className="text-sm font-semibold tracking-wide" style={{ color: 'var(--accent-gold)' }}>
          Life Mentor AI
        </h1>
        <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
          你的私人圓桌智者
        </p>
      </div>

      {/* 導師列表 */}
      <div className="flex-1 p-2 space-y-1">
        <p className="px-3 py-1 text-xs uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
          導師
        </p>
        {Object.values(PERSONAS).map((persona) => (
          <div key={persona.id} onClick={() => onSelectMentor(persona.id)}>
            <MentorBadge persona={persona} isActive={activeMentorId === persona.id} />
          </div>
        ))}
      </div>

      {/* 底部：新對話按鈕 */}
      <div className="p-3 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
        <button
          className="w-full py-2 px-3 rounded-lg text-sm transition-colors"
          style={{
            border: '1px solid var(--border-subtle)',
            color: 'var(--text-secondary)',
          }}
          onClick={() => window.location.reload()}
        >
          + 新對話
        </button>
      </div>
    </aside>
  )
}

/** 手機版底部 Tab Bar */
export function MobileMentorTabs({ activeMentorId, onSelectMentor }: MentorSidebarProps) {
  return (
    <div
      className="md:hidden flex border-t"
      style={{
        backgroundColor: 'var(--bg-sidebar)',
        borderColor: 'var(--border-subtle)',
      }}
    >
      {Object.values(PERSONAS).map((persona) => {
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
