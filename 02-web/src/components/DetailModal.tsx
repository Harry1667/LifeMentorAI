'use client'

import { useState } from 'react'
import type { Persona } from '@/lib/types/persona'

interface TheoryDetail {
  id: string
  name: string
  coreIdea: string
  category: string
  keyPrinciples?: string[]
  application?: string
  systemPromptExtension?: string
}

// 複製按鈕
function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      onClick={() => {
        navigator.clipboard.writeText(text).then(() => {
          setCopied(true)
          setTimeout(() => setCopied(false), 2000)
        })
      }}
      className="text-[10px] px-2 py-0.5 rounded transition-opacity hover:opacity-70"
      style={{ color: copied ? 'var(--accent-gold)' : 'var(--text-muted)', border: '1px solid var(--border-subtle)' }}
    >
      {copied ? '已複製' : '複製'}
    </button>
  )
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
        className="w-full max-w-2xl mx-4 rounded-xl p-6 space-y-4 max-h-[85vh] overflow-y-auto"
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
          <div className="flex-1">
            <h2 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
              {mentor.name}
            </h2>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              {mentor.fullName} · {mentor.archetype}
            </p>
          </div>
        </div>

        {/* 基本資訊（精簡） */}
        <div className="grid grid-cols-2 gap-3 text-xs">
          <div>
            <span style={{ color: 'var(--text-muted)' }}>擅長領域：</span>
            <span style={{ color: 'var(--text-secondary)' }}>{mentor.domain}</span>
          </div>
          {mentor.category && (
            <div>
              <span style={{ color: 'var(--text-muted)' }}>分類：</span>
              <span style={{ color: 'var(--text-secondary)' }}>{mentor.category}</span>
            </div>
          )}
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

        {/* System Prompt（核心） */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-xs" style={{ color: 'var(--text-muted)' }}>
              System Prompt（人格提示詞）
            </label>
            <CopyButton text={mentor.systemPrompt} />
          </div>
          <pre
            className="text-xs leading-relaxed px-3 py-2.5 rounded-lg whitespace-pre-wrap font-sans"
            style={{
              backgroundColor: 'var(--bg-chat)',
              color: 'var(--text-secondary)',
              border: '1px solid var(--border-subtle)',
              maxHeight: '50vh',
              overflowY: 'auto',
            }}
          >
            {mentor.systemPrompt}
          </pre>
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
        className="w-full max-w-2xl mx-4 rounded-xl p-6 space-y-4 max-h-[85vh] overflow-y-auto"
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

        {/* 導師使用指令（注入到 system prompt 的內容） */}
        {theory.systemPromptExtension && (
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs" style={{ color: 'var(--text-muted)' }}>
                導師使用指令（注入到 system prompt）
              </label>
              <CopyButton text={theory.systemPromptExtension} />
            </div>
            <pre
              className="text-xs leading-relaxed px-3 py-2.5 rounded-lg whitespace-pre-wrap font-sans"
              style={{
                backgroundColor: 'var(--bg-chat)',
                color: 'var(--text-secondary)',
                border: '1px solid var(--border-subtle)',
                maxHeight: '40vh',
                overflowY: 'auto',
              }}
            >
              {theory.systemPromptExtension}
            </pre>
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

