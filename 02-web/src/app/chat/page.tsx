'use client'

import { useChat } from '@ai-sdk/react'
import { DefaultChatTransport } from 'ai'
import { useState, useRef, useEffect, useMemo } from 'react'
import { UserButton } from '@clerk/nextjs'
import { PERSONAS, DEFAULT_PERSONA_ID } from '@/lib/personas'
import { MentorSidebar, MobileMentorTabs } from '@/components/MentorSidebar'
import { MessageBubble, TypingBubble } from '@/components/MessageBubble'
import { ChatInput } from '@/components/ChatInput'
import { ActionCards } from '@/components/ActionCard'

// 每個導師的快速行動建議（C0 靜態版）
const PERSONA_ACTIONS: Record<string, string[]> = {
  franklin: ['如何建立更好的習慣？', '幫我規劃今天的任務', '我拖延症很嚴重怎麼辦'],
  feynman:  ['解釋一個我不懂的概念', '我學不進去怎麼辦', '如何培養好奇心'],
  stoic:    ['我現在很焦慮', '怎麼面對失敗？', '如何找到內心平靜'],
}

export default function ChatPage() {
  const [activeMentorId, setActiveMentorId] = useState(DEFAULT_PERSONA_ID)
  const persona = PERSONAS[activeMentorId]
  const bottomRef = useRef<HTMLDivElement>(null)
  const [inputValue, setInputValue] = useState('')

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

  // 切換導師時清空對話
  function handleSelectMentor(id: string) {
    if (id === activeMentorId) return
    setActiveMentorId(id)
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

  // 行動卡片點擊 → 直接送出
  function handleActionSelect(action: string) {
    if (isLoading) return
    sendMessage({ text: action })
  }

  // 自動捲到底部
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isLoading])

  // 最後一條訊息是否是導師 → 顯示行動卡片
  const lastMessage = messages[messages.length - 1]
  const showActions = !isLoading && lastMessage?.role === 'assistant'

  return (
    <div className="flex flex-col h-full" style={{ backgroundColor: 'var(--bg-primary)' }}>
      {/* 主體：sidebar + chat */}
      <div className="flex flex-1 overflow-hidden">
        <MentorSidebar activeMentorId={activeMentorId} onSelectMentor={handleSelectMentor} />

        {/* 聊天主區域 */}
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
            <UserButton />
          </header>

          {/* 訊息列表 */}
          <div className="flex-1 overflow-y-auto px-4 py-6 space-y-4">
            {/* 空狀態：導師問候 + 快速行動 */}
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
                      style={{
                        border: `1px solid ${persona.color}`,
                        color: persona.color,
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

            {/* 導師思考中（等待第一個 token） */}
            {isLoading && lastMessage?.role === 'user' && (
              <TypingBubble persona={persona} />
            )}

            {/* 行動卡片 */}
            {showActions && (
              <ActionCards
                actions={PERSONA_ACTIONS[activeMentorId] ?? []}
                onSelect={handleActionSelect}
                accentColor={persona.color}
              />
            )}

            <div ref={bottomRef} />
          </div>

          {/* 輸入區 */}
          <ChatInput
            value={inputValue}
            onChange={setInputValue}
            onSubmit={handleSubmit}
            isLoading={isLoading}
            accentColor={persona.color}
          />
        </main>
      </div>

      {/* 手機版底部 tab */}
      <MobileMentorTabs activeMentorId={activeMentorId} onSelectMentor={handleSelectMentor} />
    </div>
  )
}
