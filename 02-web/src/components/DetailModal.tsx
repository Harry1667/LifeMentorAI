'use client'

import type { Persona } from '@/lib/types/persona'

interface TheoryDetail {
  id: string
  name: string
  coreIdea: string
  category: string
  keyPrinciples?: string[]
  application?: string
}

// 導師詳情彈窗
export function MentorDetailModal({
  mentor,
  onClose,
}: {
  mentor: Persona
  onClose: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div
        className="w-full max-w-md mx-4 rounded-xl p-6 space-y-4 max-h-[80vh] overflow-y-auto"
        style={{ backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border-subtle)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 頭部 */}
        <div className="flex items-center gap-3">
          <div
            className="w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold text-white shrink-0"
            style={{ backgroundColor: mentor.color }}
          >
            {mentor.initial}
          </div>
          <div>
            <h2 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
              {mentor.name}
            </h2>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              {mentor.fullName}
            </p>
          </div>
        </div>

        {/* 基本資訊 */}
        <div className="space-y-3">
          <InfoRow label="角色定位" value={mentor.archetype} />
          <InfoRow label="擅長領域" value={mentor.domain} />
          {mentor.category && <InfoRow label="分類" value={mentor.category} />}
        </div>

        {/* 歡迎詞 */}
        <div>
          <label className="text-xs block mb-1" style={{ color: 'var(--text-muted)' }}>
            開場白
          </label>
          <p
            className="text-sm leading-relaxed px-3 py-2 rounded-lg"
            style={{ backgroundColor: 'var(--bg-chat)', color: 'var(--text-secondary)' }}
          >
            「{mentor.greeting}」
          </p>
        </div>

        {/* 關閉 */}
        <button
          onClick={onClose}
          className="w-full py-2 rounded-lg text-sm transition-opacity hover:opacity-80"
          style={{ color: 'var(--text-muted)', border: '1px solid var(--border-subtle)' }}
        >
          關閉
        </button>
      </div>
    </div>
  )
}

// 理論詳情彈窗
export function TheoryDetailModal({
  theory,
  onClose,
}: {
  theory: TheoryDetail
  onClose: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div
        className="w-full max-w-md mx-4 rounded-xl p-6 space-y-4 max-h-[80vh] overflow-y-auto"
        style={{ backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border-subtle)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 頭部 */}
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-lg flex items-center justify-center text-sm font-bold"
            style={{ backgroundColor: 'rgba(217, 119, 6, 0.2)', color: 'var(--accent-gold)' }}
          >
            T
          </div>
          <div>
            <h2 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
              {theory.name}
            </h2>
            {theory.category && (
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                {theory.category}
              </p>
            )}
          </div>
        </div>

        {/* 核心概念 */}
        <div>
          <label className="text-xs block mb-1" style={{ color: 'var(--text-muted)' }}>
            核心概念
          </label>
          <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
            {theory.coreIdea}
          </p>
        </div>

        {/* 關鍵原則 */}
        {theory.keyPrinciples && theory.keyPrinciples.length > 0 && (
          <div>
            <label className="text-xs block mb-1" style={{ color: 'var(--text-muted)' }}>
              關鍵原則
            </label>
            <ul className="space-y-1">
              {theory.keyPrinciples.map((p, i) => (
                <li
                  key={i}
                  className="text-sm pl-3 relative before:content-['•'] before:absolute before:left-0"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  {p}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* 應用方式 */}
        {theory.application && (
          <div>
            <label className="text-xs block mb-1" style={{ color: 'var(--text-muted)' }}>
              如何應用
            </label>
            <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
              {theory.application}
            </p>
          </div>
        )}

        {/* 關閉 */}
        <button
          onClick={onClose}
          className="w-full py-2 rounded-lg text-sm transition-opacity hover:opacity-80"
          style={{ color: 'var(--text-muted)', border: '1px solid var(--border-subtle)' }}
        >
          關閉
        </button>
      </div>
    </div>
  )
}

// 共用的資訊列元件
function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <label className="text-xs block mb-0.5" style={{ color: 'var(--text-muted)' }}>
        {label}
      </label>
      <p className="text-sm" style={{ color: 'var(--text-primary)' }}>
        {value}
      </p>
    </div>
  )
}
