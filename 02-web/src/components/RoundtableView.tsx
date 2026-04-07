'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import type { Persona } from '@/lib/types/persona'

interface RoundtableMessage {
  id: string
  role: 'user' | 'mentor' | 'synthesizer'
  mentorId?: string
  mentorName?: string
  color?: string
  initial?: string
  content: string
  replyToId?: string
  timestamp: number
}

interface RoundtableViewProps {
  mentors: Persona[]
  initialQuestion: string
  sessionId?: string | null
  onClose: () => void
}

let msgIdCounter = 0
function nextId() { return `rt_${Date.now()}_${++msgIdCounter}` }

export function RoundtableView({ mentors, initialQuestion, sessionId: initialSessionId, onClose }: RoundtableViewProps) {
  const [messages, setMessages] = useState<RoundtableMessage[]>([])
  const [inputValue, setInputValue] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [replyTo, setReplyTo] = useState<RoundtableMessage | null>(null)
  const [synthesized, setSynthesized] = useState(false)
  const [sessionId, setSessionId] = useState<string | null>(initialSessionId ?? null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const mentorIds = mentors.map((m) => m.id)
  const sessionIdRef = useRef(sessionId)
  sessionIdRef.current = sessionId
  const mentorMap = Object.fromEntries(mentors.map((m) => [m.id, m]))

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isLoading])

  // 從 DB 載入歷史訊息（點 sidebar 圓桌紀錄時）
  useEffect(() => {
    if (initialSessionId && !initialQuestion) {
      fetch(`/api/conversations?sessionId=${initialSessionId}`)
        .then((r) => r.json())
        .then((msgs) => {
          if (Array.isArray(msgs) && msgs.length > 0) {
            setMessages(msgs as RoundtableMessage[])
          }
        })
        .catch(() => {})
    }
  }, [initialSessionId, initialQuestion])

  // 回應完成後自動儲存到 DB
  const prevLoading = useRef(isLoading)
  useEffect(() => {
    if (prevLoading.current && !isLoading && messages.length > 0) {
      const sid = sessionIdRef.current
      if (sid) {
        // 更新現有 session
        fetch('/api/conversations', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId: sid, messages }),
        }).catch(() => {})
      } else {
        // 建立新 session
        const title = messages.find((m) => m.role === 'user')?.content?.slice(0, 40) ?? '圓桌群聊'
        fetch('/api/conversations/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'roundtable',
            mentorIds,
            messages,
            title,
          }),
        })
          .then((r) => r.json())
          .then(({ id }) => { setSessionId(id); sessionIdRef.current = id })
          .catch(() => {})
      }
    }
    prevLoading.current = isLoading
  }, [isLoading, messages, mentorIds])

  // 解析 @提及：匹配 @導師名
  function parseMentions(text: string): string[] {
    const mentioned: string[] = []
    for (const m of mentors) {
      if (text.includes(`@${m.name}`)) mentioned.push(m.id)
    }
    // @全部
    if (text.includes('@全部') || text.includes('@所有')) {
      return [...mentorIds]
    }
    return mentioned
  }

  // 處理 SSE 串流回應
  const handleSSE = useCallback(async (
    res: Response,
    currentMessages: RoundtableMessage[],
  ) => {
    const reader = res.body!.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    // 追蹤正在串流的 mentor messages
    const streamingMsgs = new Map<string, string>()

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })

      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue
        const data = JSON.parse(line.slice(6))

        switch (data.type) {
          case 'step_start':
          case 'synthesis_start': {
            const newMsg: RoundtableMessage = {
              id: nextId(),
              role: data.type === 'synthesis_start' ? 'synthesizer' : 'mentor',
              mentorId: data.meta.mentorId,
              mentorName: data.meta.mentorName,
              color: data.meta.color,
              initial: data.meta.initial,
              content: '',
              timestamp: Date.now(),
            }
            streamingMsgs.set(data.meta.mentorId, newMsg.id)
            setMessages((prev) => [...prev, newMsg])
            break
          }

          case 'step_delta':
          case 'synthesis_delta': {
            const msgId = streamingMsgs.get(data.mentorId)
            if (msgId) {
              setMessages((prev) => prev.map((m) =>
                m.id === msgId ? { ...m, content: m.content + data.delta } : m
              ))
            }
            break
          }

          case 'step_skip': {
            // 導師選擇不回應，移除那條空訊息
            const skipMsgId = streamingMsgs.get(data.mentorId)
            if (skipMsgId) {
              setMessages((prev) => prev.filter((m) => m.id !== skipMsgId))
              streamingMsgs.delete(data.mentorId)
            }
            break
          }

          case 'step_done':
          case 'synthesis_done':
            streamingMsgs.delete(data.mentorId)
            break

          case 'step_error': {
            const errMsg: RoundtableMessage = {
              id: nextId(),
              role: 'mentor',
              mentorId: data.meta.mentorId,
              mentorName: data.meta.mentorName,
              color: data.meta.color,
              initial: data.meta.initial,
              content: data.error,
              timestamp: Date.now(),
            }
            setMessages((prev) => [...prev, errMsg])
            break
          }

          case 'done':
            setIsLoading(false)
            break
        }
      }
    }
  }, [])

  // 發送訊息
  async function sendMessage(text: string, options?: {
    replyToId?: string
    replyToMentorId?: string
    mentionedMentorIds?: string[]
    synthesize?: boolean
  }) {
    const userMsg: RoundtableMessage = {
      id: nextId(),
      role: 'user',
      content: text,
      replyToId: options?.replyToId,
      timestamp: Date.now(),
    }

    const newMessages = [...messages, userMsg]
    setMessages(newMessages)
    setIsLoading(true)
    setReplyTo(null)

    try {
      const res = await fetch('/api/roundtable', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: newMessages,
          mentorIds,
          replyToMentorId: options?.replyToMentorId,
          mentionedMentorIds: options?.mentionedMentorIds,
          synthesize: options?.synthesize,
        }),
      })

      if (!res.ok) throw new Error(await res.text())
      await handleSSE(res, newMessages)
    } catch (err) {
      console.error('[Roundtable] 發送失敗:', err)
      setIsLoading(false)
    }
  }

  // 初始化：送出第一個問題（用 ref 防止 Strict Mode 重複呼叫）
  const initialized = useRef(false)
  useEffect(() => {
    if (initialized.current) return
    initialized.current = true
    if (messages.length === 0 && initialQuestion) {
      sendMessage(initialQuestion)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const text = inputValue.trim()
    if (!text || isLoading) return

    const mentionedMentorIds = parseMentions(text)
    const replyToMentorId = replyTo?.mentorId

    sendMessage(text, {
      replyToId: replyTo?.id,
      replyToMentorId,
      mentionedMentorIds: mentionedMentorIds.length > 0 ? mentionedMentorIds : undefined,
    })
    setInputValue('')
  }

  function handleSynthesize() {
    if (isLoading) return
    setSynthesized(true)
    sendMessage('請主持人總結這次討論', { synthesize: true })
  }

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      {/* 頂部 */}
      <div
        className="flex items-center justify-between px-4 py-3 border-b shrink-0"
        style={{ borderColor: 'var(--border-subtle)' }}
      >
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium" style={{ color: 'var(--accent-gold)' }}>
            圓桌群聊
          </span>
          <div className="flex -space-x-1.5">
            {mentors.map((m) => (
              <div
                key={m.id}
                className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white border border-[var(--bg-chat)]"
                style={{ backgroundColor: m.color }}
                title={m.name}
              >
                {m.initial}
              </div>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {!synthesized && messages.length >= 4 && (
            <button
              onClick={handleSynthesize}
              disabled={isLoading}
              className="text-xs px-2 py-1 rounded transition-opacity hover:opacity-80 disabled:opacity-30"
              style={{ color: 'var(--accent-gold)', border: '1px solid var(--accent-gold)' }}
            >
              請主持人總結
            </button>
          )}
          <button
            onClick={onClose}
            className="text-xs px-2 py-1 rounded hover:opacity-70 transition-opacity"
            style={{ color: 'var(--text-muted)' }}
          >
            關閉
          </button>
        </div>
      </div>

      {/* 訊息列表 */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {messages.map((msg) => (
          <MessageRow
            key={msg.id}
            msg={msg}
            allMessages={messages}
            onReply={(m) => {
              setReplyTo(m)
              inputRef.current?.focus()
            }}
            isLoading={isLoading}
          />
        ))}

        {/* 思考中 */}
        {isLoading && messages.length > 0 && messages[messages.length - 1].role === 'user' && (
          <div className="flex gap-3">
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
              style={{ backgroundColor: 'var(--text-muted)', opacity: 0.6 }}
            >
              ?
            </div>
            <div
              className="px-3 py-2 rounded-2xl rounded-tl-sm text-sm"
              style={{ backgroundColor: 'var(--bg-bubble-mentor)', color: 'var(--text-muted)' }}
            >
              導師們正在思考
              <span className="inline-flex gap-1 ml-2">
                <span className="typing-dot w-1.5 h-1.5 rounded-full inline-block" style={{ backgroundColor: 'var(--accent-gold)' }} />
                <span className="typing-dot w-1.5 h-1.5 rounded-full inline-block" style={{ backgroundColor: 'var(--accent-gold)' }} />
                <span className="typing-dot w-1.5 h-1.5 rounded-full inline-block" style={{ backgroundColor: 'var(--accent-gold)' }} />
              </span>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* 回覆指示 */}
      {replyTo && (
        <div
          className="flex items-center justify-between px-4 py-2 text-xs border-t"
          style={{ borderColor: 'var(--border-subtle)', backgroundColor: 'var(--bg-primary)', color: 'var(--text-muted)' }}
        >
          <span>
            回覆 <span style={{ color: replyTo.color ?? 'var(--accent-gold)' }}>{replyTo.mentorName ?? '用戶'}</span>
            ：{replyTo.content.slice(0, 40)}{replyTo.content.length > 40 ? '...' : ''}
          </span>
          <button onClick={() => setReplyTo(null)} className="ml-2 hover:opacity-70">✕</button>
        </div>
      )}

      {/* 輸入區 */}
      <form
        onSubmit={handleSubmit}
        className="flex items-end gap-2 px-4 py-3 border-t shrink-0"
        style={{ borderColor: 'var(--border-subtle)' }}
      >
        <div className="flex-1 relative">
          <textarea
            ref={inputRef}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                handleSubmit(e)
              }
            }}
            placeholder={isLoading ? '導師們思考中...' : `輸入訊息，或 @${mentors[0]?.name ?? '導師名'} 點名回應`}
            disabled={isLoading}
            rows={1}
            className="w-full rounded-xl px-4 py-2.5 text-sm resize-none outline-none disabled:opacity-50"
            style={{
              backgroundColor: 'var(--bg-primary)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border-subtle)',
            }}
          />
        </div>
        <button
          type="submit"
          disabled={!inputValue.trim() || isLoading}
          className="px-4 py-2.5 rounded-xl text-sm font-medium text-white transition-opacity disabled:opacity-30"
          style={{ backgroundColor: 'var(--accent-gold)' }}
        >
          送出
        </button>
      </form>
    </div>
  )
}

// 單條訊息
function MessageRow({
  msg,
  allMessages,
  onReply,
  isLoading,
}: {
  msg: RoundtableMessage
  allMessages: RoundtableMessage[]
  onReply: (msg: RoundtableMessage) => void
  isLoading: boolean
}) {
  const isUser = msg.role === 'user'
  const isSynthesizer = msg.role === 'synthesizer'
  const replyTarget = msg.replyToId ? allMessages.find((m) => m.id === msg.replyToId) : null

  return (
    <div className={`flex gap-2.5 ${isUser ? 'justify-end' : 'justify-start'}`}>
      {/* 導師頭像 */}
      {!isUser && (
        <div
          className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0 mt-1"
          style={{ backgroundColor: msg.color ?? 'var(--accent-gold)' }}
        >
          {msg.initial ?? 'S'}
        </div>
      )}

      <div className={`max-w-[75%] ${isUser ? 'items-end' : 'items-start'} flex flex-col`}>
        {/* 導師名 */}
        {!isUser && (
          <span className="text-xs font-medium mb-0.5" style={{ color: msg.color ?? 'var(--accent-gold)' }}>
            {msg.mentorName}
            {isSynthesizer && ' — 總結'}
          </span>
        )}

        {/* 回覆引用 */}
        {replyTarget && (
          <div
            className="text-xs px-2 py-1 rounded mb-1 truncate max-w-[200px]"
            style={{ backgroundColor: 'var(--bg-primary)', color: 'var(--text-muted)' }}
          >
            回覆 {replyTarget.mentorName ?? '你'}：{replyTarget.content.slice(0, 30)}...
          </div>
        )}

        {/* 訊息泡泡 */}
        <div
          className={`group relative px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
            isUser ? 'rounded-tr-sm text-white' : 'rounded-tl-sm'
          }`}
          style={
            isUser
              ? { backgroundColor: 'var(--accent-gold)' }
              : isSynthesizer
                ? { backgroundColor: 'var(--accent-gold)', color: 'white', opacity: 0.9 }
                : { backgroundColor: 'var(--bg-bubble-mentor)', color: 'var(--text-primary)' }
          }
        >
          {msg.content}

          {/* 回覆按鈕（hover 時顯示） */}
          {!isUser && !isLoading && msg.content && (
            <button
              onClick={() => onReply(msg)}
              className="absolute -right-8 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity text-xs px-1.5 py-0.5 rounded"
              style={{ color: 'var(--text-muted)' }}
              title="回覆"
            >
              ↩
            </button>
          )}
        </div>
      </div>

      {/* 用戶佔位 */}
      {isUser && <div className="w-7 shrink-0" />}
    </div>
  )
}
