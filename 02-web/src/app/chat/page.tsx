'use client'

import { useChat } from '@ai-sdk/react'
import { DefaultChatTransport } from 'ai'
import { useState, useRef, useEffect, useMemo, useCallback } from 'react'
import { UserButton } from '@clerk/nextjs'
import { PERSONAS, DEFAULT_PERSONA_ID } from '@/lib/personas'
import type { Persona } from '@/lib/types/persona'
import { Sidebar, MobileNav } from '@/components/MentorSidebar'
import type { SessionSummary } from '@/components/MentorSidebar'
import { MessageBubble, TypingBubble } from '@/components/MessageBubble'
import { ChatInput } from '@/components/ChatInput'
import { ActionSuggestion } from '@/components/ActionSuggestion'
import { RoundtableView } from '@/components/RoundtableView'
import { DebateMentorPicker } from '@/components/DebateMentorPicker'

const PERSONA_ACTIONS: Record<string, string[]> = {
  franklin: ['如何建立更好的習慣？', '幫我規劃今天的任務', '我拖延症很嚴重怎麼辦'],
  feynman:  ['解釋一個我不懂的概念', '我學不進去怎麼辦', '如何培養好奇心'],
  stoic:    ['我現在很焦慮', '怎麼面對失敗？', '如何找到內心平靜'],
}

export default function ChatPage() {
  const [allPersonas, setAllPersonas] = useState<Persona[]>(Object.values(PERSONAS))
  const [activeMentorId, setActiveMentorId] = useState(DEFAULT_PERSONA_ID)
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null)
  const [sidebarRefreshKey, setSidebarRefreshKey] = useState(0)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [showMentorDropdown, setShowMentorDropdown] = useState(false)

  const personaMap = useMemo(
    () => Object.fromEntries(allPersonas.map((p) => [p.id, p])),
    [allPersonas]
  )
  const persona = personaMap[activeMentorId] ?? allPersonas[0]

  // 載入自訂導師
  useEffect(() => {
    fetch('/api/personas')
      .then((r) => r.json())
      .then((data: Persona[]) => setAllPersonas(data))
      .catch(() => {})
  }, [])

  const bottomRef = useRef<HTMLDivElement>(null)
  const [inputValue, setInputValue] = useState('')
  const [debateQuestion, setDebateQuestion] = useState<string | null>(null)
  const [debateMentors, setDebateMentors] = useState<Persona[]>([])
  const [debateTheoryIds, setDebateTheoryIds] = useState<string[]>([])
  const [showDebatePicker, setShowDebatePicker] = useState(false)

  const activeMentorIdRef = useRef(activeMentorId)
  activeMentorIdRef.current = activeMentorId

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: '/api/chat',
        body: () => ({ mentor: activeMentorIdRef.current }),
      }),
    []
  )

  const { messages, sendMessage, status, setMessages } = useChat({ transport })
  const isLoading = status === 'submitted' || status === 'streaming'

  // 載入對話記錄
  useEffect(() => {
    if (!activeSessionId) return
    const controller = new AbortController()
    fetch(`/api/conversations?sessionId=${activeSessionId}`, { signal: controller.signal })
      .then((r) => r.json())
      .then((msgs) => { if (Array.isArray(msgs) && msgs.length > 0) setMessages(msgs) })
      .catch(() => {})
    return () => controller.abort()
  }, [activeSessionId]) // eslint-disable-line react-hooks/exhaustive-deps

  // AI 回應完成後存到 DB
  const prevStatus = useRef(status)
  const activeSessionIdRef = useRef(activeSessionId)
  activeSessionIdRef.current = activeSessionId

  useEffect(() => {
    if (prevStatus.current !== 'ready' && status === 'ready' && messages.length > 0) {
      const sid = activeSessionIdRef.current
      if (sid) {
        fetch('/api/conversations', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId: sid, messages }),
        }).then(() => setSidebarRefreshKey((k) => k + 1)).catch(() => {})
      } else {
        fetch('/api/conversations/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: 'chat', mentorIds: [activeMentorId], messages }),
        })
          .then((r) => r.json())
          .then(({ id }) => {
            setActiveSessionId(id)
            activeSessionIdRef.current = id
            setSidebarRefreshKey((k) => k + 1)
          })
          .catch(() => {})
      }
    }
    prevStatus.current = status
  }, [status, messages, activeMentorId])

  function handleSelectMentor(id: string) {
    setDebateQuestion(null)
    setDebateMentors([]); setDebateTheoryIds([])
    setActiveSessionId(null)
    setActiveMentorId(id)
    setMessages([])
    setShowMentorDropdown(false)
  }

  function handleSelectSession(session: SessionSummary) {
    setDebateQuestion(null)
    setDebateMentors([]); setDebateTheoryIds([])
    if (session.type === 'roundtable') {
      setActiveSessionId(session.id)
      const mentorPersonas = session.mentors
        .map((m) => allPersonas.find((p) => p.name === m.name))
        .filter(Boolean) as Persona[]
      if (mentorPersonas.length >= 2) {
        setDebateMentors(mentorPersonas)
        setDebateQuestion('')
      }
    } else {
      const mentorId = session.mentors[0]
        ? allPersonas.find((p) => p.name === session.mentors[0].name)?.id
        : undefined
      if (mentorId) setActiveMentorId(mentorId)
      setActiveSessionId(session.id)
      setMessages([])
    }
  }

  function handleDeleteSession(sessionId: string) {
    if (activeSessionId === sessionId) {
      setActiveSessionId(null)
      setMessages([])
      setDebateQuestion(null)
      setDebateMentors([]); setDebateTheoryIds([])
    }
  }

  function handleNewChat() {
    setDebateQuestion(null)
    setDebateMentors([]); setDebateTheoryIds([])
    setActiveSessionId(null)
    setMessages([])
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const text = inputValue.trim()
    if (!text || isLoading) return
    sendMessage({ text })
    setInputValue('')
  }

  function handleActionSelect(action: string) {
    if (isLoading) return
    sendMessage({ text: action })
  }

  const handleRoundtableClose = useCallback(() => {
    setDebateQuestion(null)
    setDebateMentors([]); setDebateTheoryIds([])
    setSidebarRefreshKey((k) => k + 1)
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'instant' })
  }, [messages, isLoading])

  const lastMessage = messages[messages.length - 1]
  const showActions = !isLoading && lastMessage?.role === 'assistant'

  // 複製對話紀錄
  const [copySuccess, setCopySuccess] = useState(false)
  function handleCopyChat() {
    const lines = messages.map((msg) => {
      let text = ''
      if (msg.parts && msg.parts.length > 0) {
        text = msg.parts
          .filter((p): p is { type: 'text'; text: string } => p.type === 'text')
          .map((p) => p.text)
          .join('')
      } else if ((msg as unknown as { content?: string }).content) {
        text = (msg as unknown as { content: string }).content
      }
      const label = msg.role === 'user' ? '我' : persona.name
      return `${label}：\n${text}`
    })
    navigator.clipboard.writeText(lines.join('\n\n')).then(() => {
      setCopySuccess(true)
      setTimeout(() => setCopySuccess(false), 2000)
    }).catch(() => {})
  }

  const isRoundtable = debateQuestion !== null && debateMentors.length >= 2

  return (
    <div className="flex flex-col h-full" style={{ backgroundColor: 'var(--bg-chat)' }}>
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <Sidebar
          activeSessionId={activeSessionId}
          onSelectSession={handleSelectSession}
          onNewChat={handleNewChat}
          onNewRoundtable={() => { handleNewChat(); setShowDebatePicker(true) }}
          onDeleteSession={handleDeleteSession}
          collapsed={sidebarCollapsed}
          onToggle={() => setSidebarCollapsed((v) => !v)}
          refreshKey={sidebarRefreshKey}
        />

        {/* 主區域 */}
        <main className="flex flex-col flex-1 overflow-hidden">
          {/* Header */}
          <header className="flex items-center justify-between px-4 py-2.5 shrink-0" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
            <div className="flex items-center gap-3">
              <span className="text-sm font-semibold hidden sm:block" style={{ color: 'var(--accent-gold)' }}>
                Mentora
              </span>
            </div>

            <div className="flex items-center gap-2">
              {/* 導師下拉選單 */}
              {!isRoundtable && (
                <div className="relative">
                  <button
                    onClick={() => setShowMentorDropdown((v) => !v)}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-colors hover:bg-white/5"
                    style={{ color: 'var(--text-primary)' }}
                  >
                    <div
                      className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white"
                      style={{ backgroundColor: persona.color }}
                    >
                      {persona.initial}
                    </div>
                    <span>{persona.name}</span>
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <path d="M3 5l3 3 3-3" />
                    </svg>
                  </button>

                  {showMentorDropdown && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setShowMentorDropdown(false)} />
                      <div
                        className="absolute right-0 top-full mt-1 w-56 rounded-xl py-1 z-50 shadow-lg"
                        style={{ backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border-subtle)' }}
                      >
                        {Object.entries(
                          allPersonas.reduce<Record<string, Persona[]>>((acc, p) => {
                            const cat = p.category || '其他'
                            if (!acc[cat]) acc[cat] = []
                            acc[cat].push(p)
                            return acc
                          }, {})
                        ).map(([category, items]) => (
                          <div key={category}>
                            <div className="px-3 pt-2 pb-1 text-[10px] uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                              {category}
                            </div>
                            {items.map((p) => (
                              <button
                                key={p.id}
                                onClick={() => handleSelectMentor(p.id)}
                                className={`w-full flex items-center gap-3 px-3 py-2 text-left text-sm transition-colors hover:bg-white/5 ${
                                  p.id === activeMentorId ? 'bg-white/10' : ''
                                }`}
                                style={{ color: 'var(--text-primary)' }}
                              >
                                <div
                                  className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0"
                                  style={{ backgroundColor: p.color }}
                                >
                                  {p.initial}
                                </div>
                                <div className="min-w-0">
                                  <div className="text-sm">{p.name}</div>
                                  <div className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>{p.archetype}</div>
                                </div>
                              </button>
                            ))}
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              )}
              {/* 複製對話紀錄按鈕 */}
              {messages.length > 0 && (
                <button
                  onClick={handleCopyChat}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs transition-colors hover:bg-white/5"
                  style={{ color: copySuccess ? 'var(--accent-gold)' : 'var(--text-muted)' }}
                  title="複製對話紀錄"
                >
                  {copySuccess ? (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M20 6L9 17l-5-5" />
                    </svg>
                  ) : (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                      <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
                    </svg>
                  )}
                  <span className="hidden sm:inline">{copySuccess ? '已複製' : '複製對話'}</span>
                </button>
              )}
              <UserButton />
            </div>
          </header>

          {/* 圓桌群聊 */}
          {isRoundtable && (
            <RoundtableView
              initialQuestion={debateQuestion!}
              mentors={debateMentors}
              theoryIds={debateTheoryIds}
              sessionId={activeSessionId}
              onClose={handleRoundtableClose}
            />
          )}

          {/* 普通對話 */}
          {!isRoundtable && (
            <>
              <div className="flex-1 overflow-y-auto">
                <div className="max-w-3xl mx-auto px-4 py-6 space-y-5">
                  {/* 空狀態 */}
                  {messages.length === 0 && !isLoading && (
                    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6">
                      <div
                        className="w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold text-white"
                        style={{ backgroundColor: persona.color }}
                      >
                        {persona.initial}
                      </div>
                      <div className="text-center">
                        <h2 className="text-base font-medium mb-1" style={{ color: 'var(--text-primary)' }}>
                          {persona.name}
                        </h2>
                        <p className="text-sm max-w-sm" style={{ color: 'var(--text-muted)' }}>
                          {persona.greeting}
                        </p>
                      </div>
                      <div className="grid grid-cols-2 gap-2 max-w-md w-full">
                        {(PERSONA_ACTIONS[activeMentorId] ?? []).map((action) => (
                          <button
                            key={action}
                            onClick={() => handleActionSelect(action)}
                            className="px-4 py-3 rounded-xl text-sm text-left transition-colors hover:bg-white/5"
                            style={{
                              border: '1px solid var(--border-subtle)',
                              color: 'var(--text-secondary)',
                            }}
                          >
                            {action}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* 對話訊息 */}
                  {messages.map((msg, i) => {
                    // 相容兩種格式：UIMessage（parts）和舊格式（content）
                    let textContent = ''
                    if (msg.parts && msg.parts.length > 0) {
                      textContent = msg.parts
                        .filter((p): p is { type: 'text'; text: string } => p.type === 'text')
                        .map((p) => p.text)
                        .join('')
                    } else if ((msg as unknown as { content?: string }).content) {
                      textContent = (msg as unknown as { content: string }).content
                    }

                    const isLastStreaming =
                      isLoading && i === messages.length - 1 && msg.role === 'assistant'

                    return (
                      <MessageBubble
                        key={msg.id}
                        role={msg.role as 'user' | 'assistant'}
                        content={textContent}
                        persona={persona}
                        isStreaming={isLastStreaming}
                      />
                    )
                  })}

                  {isLoading && lastMessage?.role === 'user' && (
                    <TypingBubble persona={persona} />
                  )}

                  {/* 行動建議 */}
                  {showActions && (() => {
                    let lastText = ''
                    if (lastMessage.parts && lastMessage.parts.length > 0) {
                      lastText = lastMessage.parts
                        .filter((p): p is { type: 'text'; text: string } => p.type === 'text')
                        .map((p) => p.text).join('')
                    } else if ((lastMessage as unknown as { content?: string }).content) {
                      lastText = (lastMessage as unknown as { content: string }).content
                    }
                    const actionMatch = lastText.match(/【行動】(.+)/)
                    if (!actionMatch) return null
                    return (
                      <ActionSuggestion
                        advice={actionMatch[1].trim()}
                        mentorSource={persona.name}
                        accentColor={persona.color}
                      />
                    )
                  })()}

                  <div ref={bottomRef} />
                </div>
              </div>

              <ChatInput
                value={inputValue}
                onChange={setInputValue}
                onSubmit={handleSubmit}
                onRoundtable={() => setShowDebatePicker(true)}
                isLoading={isLoading}
                accentColor={persona.color}
              />
            </>
          )}
        </main>
      </div>

      <MobileNav />

      {showDebatePicker && (
        <DebateMentorPicker
          personas={allPersonas}
          initialQuestion={inputValue.trim()}
          onCancel={() => setShowDebatePicker(false)}
          onStart={(q, mentors, theoryIds) => {
            setShowDebatePicker(false)
            setInputValue('')
            setActiveSessionId(null)
            setDebateMentors(mentors)
            setDebateTheoryIds(theoryIds)
            setDebateQuestion(q)
          }}
        />
      )}
    </div>
  )
}
