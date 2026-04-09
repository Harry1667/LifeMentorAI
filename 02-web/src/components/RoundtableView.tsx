'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import type { Persona } from '@/lib/types/persona'
import { MentorDetailModal } from '@/components/DetailModal'

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
  theoryIds?: string[]
  sessionId?: string | null
  onClose: () => void
  onSessionCreated?: () => void
}

let msgIdCounter = 0
function nextId() { return `rt_${Date.now()}_${++msgIdCounter}` }

// eslint-disable-next-line @typescript-eslint/no-unused-vars -- onClose 保留給未來 UI 使用
export function RoundtableView({ mentors, initialQuestion, theoryIds, sessionId: initialSessionId, onClose, onSessionCreated }: RoundtableViewProps) {
  const [messages, setMessages] = useState<RoundtableMessage[]>([])
  const [inputValue, setInputValue] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [replyTo, setReplyTo] = useState<RoundtableMessage | null>(null)
  const [isComposing, setIsComposing] = useState(false)
  const [copySuccess, setCopySuccess] = useState(false)
  const [synthesized, setSynthesized] = useState(false)
  const [detailMentor, setDetailMentor] = useState<Persona | null>(null)
  const [sessionId, setSessionId] = useState<string | null>(initialSessionId ?? null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const mentorIds = mentors.map((m) => m.id)
  const sessionIdRef = useRef(sessionId)
  useEffect(() => { sessionIdRef.current = sessionId }, [sessionId])
  const abortRef = useRef<AbortController | null>(null)
  const messagesRef = useRef(messages)
  useEffect(() => { messagesRef.current = messages }, [messages])

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

  // 儲存對話到 DB（用 ref 鎖防止並發 create）
  const savingRef = useRef(false)
  const saveSession = useCallback((msgs: RoundtableMessage[]) => {
    if (msgs.length === 0) return
    const sid = sessionIdRef.current
    if (sid) {
      fetch('/api/conversations', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: sid, messages: msgs }),
      }).then(() => onSessionCreated?.()).catch(() => {})
    } else {
      if (savingRef.current) return
      savingRef.current = true
      const title = msgs.find((m) => m.role === 'user')?.content?.slice(0, 40) ?? '圓桌群聊'
      fetch('/api/conversations/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'roundtable',
          mentorIds,
          messages: msgs,
          title,
        }),
      })
        .then((r) => r.json())
        .then(({ id }) => { setSessionId(id); sessionIdRef.current = id; onSessionCreated?.() })
        .catch(() => {})
        .finally(() => { savingRef.current = false })
    }
  }, [mentorIds, onSessionCreated])

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
            // 用 ref 取最新的 messages 儲存
            saveSession(messagesRef.current)
            break
        }
      }
    }
  }, [saveSession])

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

    // 如果正在串流，先中斷
    if (abortRef.current) {
      abortRef.current.abort()
      abortRef.current = null
    }

    // 清除插嘴中斷產生的空 mentor messages
    const cleaned = messagesRef.current.filter(
      (m) => m.role === 'user' || m.content.trim() !== ''
    )
    const newMessages = [...cleaned, userMsg]
    setMessages(newMessages)
    setIsLoading(true)
    setReplyTo(null)

    const controller = new AbortController()
    abortRef.current = controller

    try {
      const res = await fetch('/api/roundtable', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: newMessages,
          mentorIds,
          theoryIds: theoryIds ?? [],
          replyToMentorId: options?.replyToMentorId,
          mentionedMentorIds: options?.mentionedMentorIds,
          synthesize: options?.synthesize,
        }),
        signal: controller.signal,
      })

      if (!res.ok) throw new Error(await res.text())
      await handleSSE(res)
    } catch (err) {
      if ((err as Error).name === 'AbortError') {
        // 用戶插嘴中斷，儲存當前狀態
        saveSession(messagesRef.current)
      } else {
        console.error('[Roundtable] 發送失敗:', err)
      }
      setIsLoading(false)
    } finally {
      abortRef.current = null
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
    if (!text) return

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
              <button
                key={m.id}
                onClick={() => setDetailMentor(m)}
                className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white border border-[var(--bg-chat)] cursor-pointer hover:scale-110 transition-transform"
                style={{ backgroundColor: m.color }}
                title={`查看 ${m.name} 的詳情`}
              >
                {m.initial}
              </button>
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
          {messages.length > 0 && (
            <button
              onClick={() => {
                const lines = messages.map((m) => {
                  const label = m.role === 'user' ? '我' : (m.mentorName ?? '主持人')
                  return label + '：\n' + m.content
                })
                navigator.clipboard.writeText(lines.join('\n\n')).then(() => {
                  setCopySuccess(true)
                  setTimeout(() => setCopySuccess(false), 2000)
                })
              }}
              className="flex items-center gap-1 text-xs px-2 py-1 rounded transition-colors hover:bg-white/5"
              style={{ color: copySuccess ? 'var(--accent-gold)' : 'var(--text-muted)' }}
              title="複製對話紀錄"
            >
              {copySuccess ? (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 6L9 17l-5-5" />
                </svg>
              ) : (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                  <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
                </svg>
              )}
              <span className="hidden sm:inline">{copySuccess ? '已複製' : '複製對話'}</span>
            </button>
          )}
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

        {/* 等待用戶回覆（導師問了 @用戶 問題後） */}
        {!isLoading && messages.length > 0 && messages[messages.length - 1].role === 'mentor' && messages[messages.length - 1].content.includes('@用戶') && (
          <div
            className="text-center text-xs py-2"
            style={{ color: 'var(--accent-gold)' }}
          >
            導師們在等你的回覆
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
          {/* @mention 下拉選單 */}
          <MentionDropdown
            inputValue={inputValue}
            mentors={mentors}
            onSelect={(name) => {
              // 找到最後一個 @ 的位置，替換成 @名字
              const lastAt = inputValue.lastIndexOf('@')
              if (lastAt >= 0) {
                setInputValue(inputValue.slice(0, lastAt) + `@${name} `)
              }
              inputRef.current?.focus()
            }}
          />
          <textarea
            ref={inputRef}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => {
              if (isComposing) return
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                handleSubmit(e)
              }
            }}
            onCompositionStart={() => setIsComposing(true)}
            onCompositionEnd={() => setIsComposing(false)}
            placeholder={isLoading ? '導師們討論中...（你可以隨時插嘴）' : `輸入訊息，或 @${mentors[0]?.name ?? '導師名'} 點名回應`}
            rows={1}
            className="w-full rounded-xl px-4 py-2.5 text-sm resize-none outline-none"
            style={{
              backgroundColor: 'var(--bg-primary)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border-subtle)',
            }}
          />
        </div>
        <button
          type="submit"
          disabled={!inputValue.trim()}
          className="px-4 py-2.5 rounded-xl text-sm font-medium text-white transition-opacity disabled:opacity-30"
          style={{ backgroundColor: 'var(--accent-gold)' }}
        >
          送出
        </button>
      </form>

      {/* 導師詳情彈窗 */}
      {detailMentor && (
        <MentorDetailModal mentor={detailMentor} onClose={() => setDetailMentor(null)} />
      )}
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
          <MentionText text={msg.content} isUserBubble={isUser} />

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

// @提及高亮元件
function MentionText({ text, isUserBubble }: { text: string; isUserBubble?: boolean }) {
  const parts = text.split(/(@\S+)/g)
  return (
    <>
      {parts.map((part, i) =>
        part.startsWith('@') ? (
          <span
            key={i}
            className="font-semibold underline"
            style={{ color: isUserBubble ? '#ffffff' : 'var(--accent-gold)' }}
          >
            {part}
          </span>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </>
  )
}

// @mention 下拉選單：輸入 @ 時顯示可選的人
function MentionDropdown({
  inputValue,
  mentors,
  onSelect,
}: {
  inputValue: string
  mentors: Persona[]
  onSelect: (name: string) => void
}) {
  // 找到最後一個 @ 後面的文字作為搜尋關鍵字
  const lastAtIndex = inputValue.lastIndexOf('@')
  if (lastAtIndex < 0) return null

  // @ 後面不能有空格（有空格表示已經完成 tag）
  const afterAt = inputValue.slice(lastAtIndex + 1)
  if (afterAt.includes(' ')) return null

  const query = afterAt.toLowerCase()

  // 可選項目：所有導師 + 「全部」
  const options = [
    ...mentors.map((m) => ({ name: m.name, color: m.color, initial: m.initial })),
    { name: '全部', color: '#d97706', initial: '全' },
  ]

  const filtered = query
    ? options.filter((o) => o.name.toLowerCase().includes(query))
    : options

  if (filtered.length === 0) return null

  return (
    <div
      className="absolute bottom-full left-0 right-0 mb-1 rounded-xl py-1 shadow-lg z-50 max-h-48 overflow-y-auto"
      style={{ backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border-subtle)' }}
    >
      {filtered.map((o) => (
        <button
          key={o.name}
          type="button"
          onMouseDown={(e) => {
            e.preventDefault()  // 防止 textarea 失焦
            onSelect(o.name)
          }}
          className="w-full flex items-center gap-2.5 px-3 py-2 text-left text-sm hover:bg-white/10 transition-colors"
          style={{ color: 'var(--text-primary)' }}
        >
          <div
            className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0"
            style={{ backgroundColor: o.color }}
          >
            {o.initial}
          </div>
          <span>@{o.name}</span>
        </button>
      ))}
    </div>
  )
}
