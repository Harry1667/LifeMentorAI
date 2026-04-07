'use client'

import { useRef, type FormEvent, type KeyboardEvent } from 'react'

interface ChatInputProps {
  value: string
  onChange: (value: string) => void
  onSubmit: (e: FormEvent) => void
  onRoundtable?: () => void
  isLoading: boolean
  accentColor?: string
  placeholder?: string
}

export function ChatInput({
  value,
  onChange,
  onSubmit,
  onRoundtable,
  isLoading,
  accentColor = 'var(--accent-gold)',
  placeholder,
}: ChatInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (!isLoading && value.trim()) {
        onSubmit(e as unknown as FormEvent)
      }
    }
  }

  function handleChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    onChange(e.target.value)
    const el = textareaRef.current
    if (el) {
      el.style.height = 'auto'
      el.style.height = Math.min(el.scrollHeight, 160) + 'px'
    }
  }

  return (
    <div className="px-4 pb-4 pt-2 shrink-0">
      <form
        onSubmit={onSubmit}
        className="relative max-w-3xl mx-auto"
      >
        <div
          className="flex items-end rounded-2xl transition-colors"
          style={{
            backgroundColor: 'var(--bg-input)',
            border: '1px solid var(--border-input)',
          }}
        >
          {/* 圓桌群聊按鈕 */}
          {onRoundtable && (
            <button
              type="button"
              onClick={onRoundtable}
              className="shrink-0 px-3 py-3 text-xs transition-opacity hover:opacity-70"
              style={{ color: 'var(--text-muted)' }}
              title="圓桌群聊"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <circle cx="12" cy="12" r="10" />
                <circle cx="12" cy="8" r="2" />
                <circle cx="7" cy="14" r="2" />
                <circle cx="17" cy="14" r="2" />
              </svg>
            </button>
          )}

          <textarea
            ref={textareaRef}
            value={value}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            placeholder={placeholder ?? (isLoading ? '思考中...' : '輸入訊息...（Enter 送出）')}
            rows={1}
            disabled={isLoading}
            className="flex-1 resize-none bg-transparent px-4 py-3 text-sm outline-none disabled:opacity-50"
            style={{
              color: 'var(--text-primary)',
              minHeight: '44px',
              maxHeight: '160px',
            }}
          />

          <button
            type="submit"
            disabled={isLoading || !value.trim()}
            className="shrink-0 w-9 h-9 m-1.5 rounded-xl flex items-center justify-center transition-opacity disabled:opacity-20"
            style={{ backgroundColor: accentColor }}
          >
            {isLoading ? (
              <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M3 13V3l10 5-10 5z" fill="white" />
              </svg>
            )}
          </button>
        </div>
      </form>
    </div>
  )
}
