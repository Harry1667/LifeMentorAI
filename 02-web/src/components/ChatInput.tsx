'use client'

import { useRef, type FormEvent, type KeyboardEvent } from 'react'

interface ChatInputProps {
  value: string
  onChange: (value: string) => void
  onSubmit: (e: FormEvent) => void
  isLoading: boolean
  accentColor?: string
}

export function ChatInput({ value, onChange, onSubmit, isLoading, accentColor = 'var(--accent-gold)' }: ChatInputProps) {
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
    // 自動調整高度
    const el = textareaRef.current
    if (el) {
      el.style.height = 'auto'
      el.style.height = Math.min(el.scrollHeight, 160) + 'px'
    }
  }

  return (
    <form
      onSubmit={onSubmit}
      className="flex items-end gap-2 p-3 border-t"
      style={{ borderColor: 'var(--border-subtle)', backgroundColor: 'var(--bg-primary)' }}
    >
      <textarea
        ref={textareaRef}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder="輸入訊息…（Enter 送出，Shift+Enter 換行）"
        rows={1}
        disabled={isLoading}
        className="flex-1 resize-none rounded-xl px-4 py-2.5 text-sm outline-none transition-colors disabled:opacity-50"
        style={{
          backgroundColor: 'var(--bg-bubble-mentor)',
          color: 'var(--text-primary)',
          border: '1px solid var(--border-subtle)',
          minHeight: '44px',
          maxHeight: '160px',
        }}
      />
      <button
        type="submit"
        disabled={isLoading || !value.trim()}
        className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-opacity disabled:opacity-30"
        style={{ backgroundColor: accentColor }}
      >
        {isLoading ? (
          <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
        ) : (
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M14 8L2 2l3 6-3 6 12-6z" fill="white" />
          </svg>
        )}
      </button>
    </form>
  )
}
