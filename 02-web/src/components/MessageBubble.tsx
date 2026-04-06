'use client'

import type { Persona } from '@/lib/types/persona'

interface MessageBubbleProps {
  role: 'user' | 'assistant'
  content: string
  persona?: Persona
  isStreaming?: boolean
}

export function MessageBubble({ role, content, persona, isStreaming }: MessageBubbleProps) {
  const isAssistant = role === 'assistant'

  return (
    <div className={`flex gap-3 ${isAssistant ? 'justify-start' : 'justify-end'}`}>
      {/* 導師頭像 */}
      {isAssistant && persona && (
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold text-white shrink-0 mt-1"
          style={{ backgroundColor: persona.color }}
        >
          {persona.initial}
        </div>
      )}

      {/* 訊息氣泡 */}
      <div
        className={`max-w-[72%] px-4 py-3 rounded-2xl text-sm leading-relaxed ${
          isAssistant
            ? 'rounded-tl-sm'
            : 'rounded-tr-sm text-white'
        }`}
        style={
          isAssistant
            ? { backgroundColor: 'var(--bg-bubble-mentor)', color: 'var(--text-primary)' }
            : { backgroundColor: 'var(--accent-gold)' }
        }
      >
        {content}
        {isStreaming && (
          <span className="inline-flex gap-0.5 ml-1.5 align-middle">
            <span className="typing-dot w-1 h-1 rounded-full bg-current inline-block" />
            <span className="typing-dot w-1 h-1 rounded-full bg-current inline-block" />
            <span className="typing-dot w-1 h-1 rounded-full bg-current inline-block" />
          </span>
        )}
      </div>

      {/* 使用者佔位（保持右對齊間距） */}
      {!isAssistant && <div className="w-8 shrink-0" />}
    </div>
  )
}

/** 導師思考中的佔位泡泡 */
export function TypingBubble({ persona }: { persona: Persona }) {
  return (
    <div className="flex gap-3 justify-start">
      <div
        className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold text-white shrink-0 mt-1"
        style={{ backgroundColor: persona.color }}
      >
        {persona.initial}
      </div>
      <div
        className="px-4 py-3 rounded-2xl rounded-tl-sm"
        style={{ backgroundColor: 'var(--bg-bubble-mentor)' }}
      >
        <span className="inline-flex gap-1 items-center">
          <span className="typing-dot w-1.5 h-1.5 rounded-full" style={{ backgroundColor: persona.color }} />
          <span className="typing-dot w-1.5 h-1.5 rounded-full" style={{ backgroundColor: persona.color }} />
          <span className="typing-dot w-1.5 h-1.5 rounded-full" style={{ backgroundColor: persona.color }} />
        </span>
      </div>
    </div>
  )
}
