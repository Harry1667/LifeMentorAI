'use client'

import type { Persona } from '@/lib/types/persona'

interface MessageBubbleProps {
  role: 'user' | 'assistant'
  content: string
  persona?: Persona
  isStreaming?: boolean
}

// 跳脫 HTML 特殊字元，防止 XSS
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

// 簡易 markdown → HTML（先跳脫 HTML 再處理 markdown）
function renderMarkdown(text: string): string {
  return escapeHtml(text)
    // code blocks
    .replace(/```(\w*)\n([\s\S]*?)```/g, '<pre class="md-code-block"><code>$2</code></pre>')
    // inline code
    .replace(/`([^`]+)`/g, '<code class="md-inline-code">$1</code>')
    // bold
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    // italic
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    // h3
    .replace(/^### (.+)$/gm, '<h3 class="md-h3">$1</h3>')
    // h2
    .replace(/^## (.+)$/gm, '<h2 class="md-h2">$1</h2>')
    // unordered list
    .replace(/^- (.+)$/gm, '<li class="md-li">$1</li>')
    // ordered list
    .replace(/^\d+\. (.+)$/gm, '<li class="md-li md-ol">$1</li>')
    // paragraphs (double newline)
    .replace(/\n\n/g, '</p><p class="md-p">')
    // single newline within paragraph
    .replace(/\n/g, '<br/>')
}

export function MessageBubble({ role, content, persona, isStreaming }: MessageBubbleProps) {
  const isUser = role === 'user'

  if (isUser) {
    return (
      <div className="flex justify-end">
        <div
          className="max-w-[85%] px-4 py-3 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap"
          style={{
            backgroundColor: 'var(--bg-user-msg)',
            color: 'var(--text-primary)',
          }}
        >
          {content}
        </div>
      </div>
    )
  }

  // Assistant 訊息
  return (
    <div className="flex gap-3">
      {/* 導師圖標 */}
      {persona && (
        <div
          className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0 mt-0.5"
          style={{ backgroundColor: persona.color }}
        >
          {persona.initial}
        </div>
      )}
      <div className="flex-1 min-w-0">
        {/* 導師名 */}
        {persona && (
          <span className="text-xs font-medium mb-1 block" style={{ color: 'var(--text-muted)' }}>
            {persona.name}
          </span>
        )}
        {/* 內容（Markdown 渲染） */}
        <div
          className="md-content text-sm leading-relaxed"
          style={{ color: 'var(--text-primary)' }}
          dangerouslySetInnerHTML={{ __html: renderMarkdown(content) }}
        />
        {isStreaming && (
          <span className="inline-flex gap-0.5 ml-1 align-middle">
            <span className="typing-dot w-1 h-1 rounded-full bg-current inline-block" />
            <span className="typing-dot w-1 h-1 rounded-full bg-current inline-block" />
            <span className="typing-dot w-1 h-1 rounded-full bg-current inline-block" />
          </span>
        )}
      </div>
    </div>
  )
}

/** 導師思考中 */
export function TypingBubble({ persona }: { persona: Persona }) {
  return (
    <div className="flex gap-3">
      <div
        className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
        style={{ backgroundColor: persona.color }}
      >
        {persona.initial}
      </div>
      <div className="flex items-center gap-1.5 py-2">
        <span className="typing-dot w-1.5 h-1.5 rounded-full" style={{ backgroundColor: persona.color }} />
        <span className="typing-dot w-1.5 h-1.5 rounded-full" style={{ backgroundColor: persona.color }} />
        <span className="typing-dot w-1.5 h-1.5 rounded-full" style={{ backgroundColor: persona.color }} />
      </div>
    </div>
  )
}
