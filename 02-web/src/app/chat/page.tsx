'use client'

import { useChat } from '@ai-sdk/react'
import { DefaultChatTransport } from 'ai'
import { useState, useRef, useEffect, useMemo, useCallback } from 'react'
import { UserButton } from '@clerk/nextjs'
import { PERSONAS, DEFAULT_PERSONA_ID } from '@/lib/personas'
import type { Persona } from '@/lib/types/persona'
import { MentorSidebar, MobileMentorTabs } from '@/components/MentorSidebar'
import type { SessionSummary } from '@/components/MentorSidebar'
import { MessageBubble, TypingBubble } from '@/components/MessageBubble'
import { ChatInput } from '@/components/ChatInput'
import { ActionCards } from '@/components/ActionCard'
import { ActionSuggestion } from '@/components/ActionSuggestion'
import { RoundtableView } from '@/components/RoundtableView'
import { DebateMentorPicker } from '@/components/DebateMentorPicker'

// 內建導師的快速行動建議
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
  const [showDebatePicker, setShowDebatePicker] = useState(false)

  // 用 ref 讓 transport 的 body 函數能讀到最新 mentor
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
        // 更新現有 session
        fetch('/api/conversations', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId: sid, messages }),
        }).then(() => setSidebarRefreshKey((k) => k + 1)).catch(() => {})
      } else {
        // 建立新 session
        fetch('/api/conversations/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'chat',
            mentorIds: [activeMentorId],
            messages,
          }),
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

  // 切換導師
  function handleSelectMentor(id: string) {
    setDebateQuestion(null)
    setDebateMentors([])
    setActiveSessionId(null)
    setActiveMentorId(id)
    setMessages([])
  }

  // 選擇對話紀錄
  function handleSelectSession(session: SessionSummary) {
    setDebateQuestion(null)
    setDebateMentors([])

    if (session.type === 'roundtable') {
      // 圓桌群聊：載入到 RoundtableView
      setActiveSessionId(session.id)
      const mentorPersonas = session.mentors
        .map((m) => allPersonas.find((p) => p.name === m.name))
        .filter(Boolean) as Persona[]
      if (mentorPersonas.length >= 2) {
        setDebateMentors(mentorPersonas)
        setDebateQuestion('') // 空字串表示從歷史載入，不觸發初始發送
      }
    } else {
      // 普通對話
      const mentorId = session.mentors[0]
        ? allPersonas.find((p) => p.name === session.mentors[0].name)?.id
        : undefined
      if (mentorId) setActiveMentorId(mentorId)
      setActiveSessionId(session.id)
      setMessages([])
    }
  }

  // 刪除對話
  function handleDeleteSession(sessionId: string) {
    if (activeSessionId === sessionId) {
      setActiveSessionId(null)
      setMessages([])
      setDebateQuestion(null)
      setDebateMentors([])
    }
  }

  // 新對話
  function handleNewChat() {
    setDebateQuestion(null)
    setDebateMentors([])
    setActiveSessionId(null)
    setMessages([])
  }

  // 送出訊息
  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const text = inputValue.trim()
    if (!text || isLoading) return
    sendMessage({ text })
    setInputValue('')
  }

  // 行動卡片點擊
  function handleActionSelect(action: string) {
    if (isLoading) return
    sendMessage({ text: action })
  }

  // 圓桌群聊關閉時儲存並刷新 sidebar
  const handleRoundtableClose = useCallback(() => {
    setDebateQuestion(null)
    setDebateMentors([])
    setSidebarRefreshKey((k) => k + 1)
  }, [])

  // 自動捲到底部
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'instant' })
  }, [messages, isLoading])

  const lastMessage = messages[messages.length - 1]
  const showActions = !isLoading && lastMessage?.role === 'assistant'

  return (
    <div className="flex flex-col h-full" style={{ backgroundColor: 'var(--bg-primary)' }}>
      <div className="flex flex-1 overflow-hidden">
        <MentorSidebar
          activeMentorId={activeMentorId}
          activeSessionId={activeSessionId}
          onSelectMentor={handleSelectMentor}
          onSelectSession={handleSelectSession}
          onNewChat={handleNewChat}
          onDeleteSession={handleDeleteSession}
          personas={allPersonas}
          refreshKey={sidebarRefreshKey}
        />

        <main className="flex flex-col flex-1 overflow-hidden" style={{ backgroundColor: 'var(--bg-chat)' }}>
          {/* 頂部 header */}
          <header
            className="flex items-center justify-between px-4 py-3 border-b shrink-0"
            style={{ borderColor: 'var(--border-subtle)' }}
          >
            <div className="flex items-center gap-2">
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white"
                style={{ backgroundColor: persona.color }}
              >
                {persona.initial}
              </div>
              <div>
                <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                  {persona.name}
                </span>
                <span className="text-xs ml-2" style={{ color: 'var(--text-muted)' }}>
                  {persona.archetype}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowDebatePicker(true)}
                className="text-xs px-3 py-1.5 rounded-lg transition-opacity hover:opacity-80"
                style={{ border: '1px solid var(--accent-gold)', color: 'var(--accent-gold)' }}
              >
                圓桌群聊
              </button>
              <UserButton />
            </div>
          </header>

          {/* 圓桌群聊模式 */}
          {debateQuestion !== null && debateMentors.length >= 2 && (
            <RoundtableView
              initialQuestion={debateQuestion}
              mentors={debateMentors}
              sessionId={activeSessionId}
              onClose={handleRoundtableClose}
            />
          )}

          {/* 普通對話模式 */}
          {debateQuestion === null && <div className="flex-1 overflow-y-auto px-4 py-6 space-y-4">
            {/* 空狀態 */}
            {messages.length === 0 && !isLoading && (
              <div className="flex flex-col items-center justify-center h-full gap-6 pb-20">
                <div
                  className="w-16 h-16 rounded-full flex items-center justify-center text-2xl font-bold text-white"
                  style={{ backgroundColor: persona.color }}
                >
                  {persona.initial}
                </div>
                <p
                  className="text-center max-w-sm text-base leading-relaxed"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  {persona.greeting}
                </p>
                <div className="flex flex-wrap gap-2 justify-center">
                  {(PERSONA_ACTIONS[activeMentorId] ?? []).map((action) => (
                    <button
                      key={action}
                      onClick={() => handleActionSelect(action)}
                      className="px-3 py-1.5 rounded-lg text-sm transition-opacity hover:opacity-70"
                      style={{ border: `1px solid ${persona.color}`, color: persona.color }}
                    >
                      {action}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* 對話訊息 */}
            {messages.map((msg, i) => {
              const textContent = msg.parts
                .filter((p): p is { type: 'text'; text: string } => p.type === 'text')
                .map((p) => p.text)
                .join('')

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

            {/* 行動建議（從最後一條 assistant 回應中解析） */}
            {showActions && (() => {
              const lastText = lastMessage.parts
                .filter((p): p is { type: 'text'; text: string } => p.type === 'text')
                .map((p) => p.text).join('')
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

            {showActions && (
              <ActionCards
                actions={PERSONA_ACTIONS[activeMentorId] ?? []}
                onSelect={handleActionSelect}
                accentColor={persona.color}
              />
            )}

            <div ref={bottomRef} />
          </div>}

          {debateQuestion === null && <ChatInput
            value={inputValue}
            onChange={setInputValue}
            onSubmit={handleSubmit}
            isLoading={isLoading}
            accentColor={persona.color}
          />}
        </main>
      </div>

      <MobileMentorTabs activeMentorId={activeMentorId} onSelectMentor={handleSelectMentor} personas={allPersonas} />

      {showDebatePicker && (
        <DebateMentorPicker
          personas={allPersonas}
          initialQuestion={inputValue.trim()}
          onCancel={() => setShowDebatePicker(false)}
          onStart={(q, mentors) => {
            setShowDebatePicker(false)
            setInputValue('')
            setActiveSessionId(null)
            setDebateMentors(mentors)
            setDebateQuestion(q)
          }}
        />
      )}
    </div>
  )
}
