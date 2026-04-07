'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import type { Persona } from '@/lib/types/persona'

interface StepMeta {
  mentorId: string
  mentorName: string
  color: string
  initial: string
}

interface DebateStep {
  meta: StepMeta
  content: string
  error?: boolean
  done: boolean
}

interface DebateViewProps {
  question: string
  mentors: Persona[]
  onClose: () => void
}

export function DebateView({ question, mentors, onClose }: DebateViewProps) {
  const [steps, setSteps] = useState<DebateStep[]>([])
  const [synthesis, setSynthesis] = useState<DebateStep | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [currentMentor, setCurrentMentor] = useState<string>('')
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [steps, synthesis, currentMentor])

  // 更新 step 的 content（逐字累加）
  const appendDelta = useCallback((mentorId: string, delta: string, isSynthesis: boolean) => {
    if (isSynthesis) {
      setSynthesis((prev) => prev ? { ...prev, content: prev.content + delta } : prev)
    } else {
      setSteps((prev) => prev.map((s) =>
        s.meta.mentorId === mentorId ? { ...s, content: s.content + delta } : s
      ))
    }
  }, [])

  useEffect(() => {
    const mentorIds = mentors.map((m) => m.id)
    const controller = new AbortController()

    fetch('/api/debate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question, mentorIds }),
      signal: controller.signal,
    })
      .then(async (res) => {
        if (!res.ok) throw new Error(await res.text())
        const reader = res.body!.getReader()
        const decoder = new TextDecoder()
        let buffer = ''

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
                setSteps((prev) => [...prev, { meta: data.meta, content: '', done: false }])
                setCurrentMentor('')
                break

              case 'step_delta':
                appendDelta(data.mentorId, data.delta, false)
                break

              case 'step_done':
                setSteps((prev) => prev.map((s) =>
                  s.meta.mentorId === data.mentorId ? { ...s, done: true } : s
                ))
                break

              case 'step_error':
                setSteps((prev) => [...prev, {
                  meta: data.meta,
                  content: data.error,
                  error: true,
                  done: true,
                }])
                break

              case 'synthesis_start':
                setSynthesis({ meta: data.meta, content: '', done: false })
                setCurrentMentor('')
                break

              case 'synthesis_delta':
                appendDelta(data.mentorId, data.delta, true)
                break

              case 'synthesis_done':
                setSynthesis((prev) => prev ? { ...prev, done: true } : prev)
                break

              case 'synthesis_error':
                break

              case 'done':
                setIsLoading(false)
                setCurrentMentor('')
                break
            }
          }
        }
      })
      .catch((err) => {
        if (err.name !== 'AbortError') console.error('[Debate] 連線失敗:', err)
        setIsLoading(false)
      })

    return () => controller.abort()
  }, [question, mentors, appendDelta])

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      {/* 頂部 */}
      <div
        className="flex items-center justify-between px-4 py-3 border-b shrink-0"
        style={{ borderColor: 'var(--border-subtle)' }}
      >
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium" style={{ color: 'var(--accent-gold)' }}>
            圓桌辯論
          </span>
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
            {mentors.map((m) => m.name).join(' vs ')}
          </span>
        </div>
        <button
          onClick={onClose}
          className="text-xs px-2 py-1 rounded hover:opacity-70 transition-opacity"
          style={{ color: 'var(--text-muted)' }}
        >
          關閉
        </button>
      </div>

      {/* 辯論內容 */}
      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-4">
        {/* 用戶問題 */}
        <div className="flex justify-end">
          <div
            className="max-w-[72%] px-4 py-3 rounded-2xl rounded-tr-sm text-sm leading-relaxed text-white"
            style={{ backgroundColor: 'var(--accent-gold)' }}
          >
            {question}
          </div>
        </div>

        {/* 各導師回應 */}
        {steps.map((step, i) => (
          <StepBubble key={i} step={step} />
        ))}

        {/* 思考中指示（在兩個 step 之間，或等待主持人） */}
        {isLoading && steps.length > 0 && steps[steps.length - 1].done && !synthesis && (
          <ThinkingIndicator
            name={steps.length < mentors.length ? mentors[steps.length].name : '主持人'}
            color={steps.length < mentors.length ? mentors[steps.length].color : '#d97706'}
          />
        )}

        {/* 主持人整合 */}
        {synthesis && (
          <div className="mt-4 pt-4" style={{ borderTop: '1px solid var(--border-subtle)' }}>
            <StepBubble step={synthesis} isSynthesis />
          </div>
        )}

        {/* 行動建議卡片（辯論結束後從主持人回應中解析） */}
        {!isLoading && synthesis?.done && (() => {
          const actions = synthesis.content
            .split('\n')
            .filter((line) => line.startsWith('【行動】'))
            .map((line) => line.replace('【行動】', '').trim())
            .filter(Boolean)
          if (actions.length === 0) return null
          return (
            <div className="ml-11 mt-3 space-y-2">
              <span className="text-xs block" style={{ color: 'var(--text-muted)' }}>建議行動：</span>
              <div className="flex flex-wrap gap-2">
                {actions.map((action) => (
                  <button
                    key={action}
                    className="px-3 py-1.5 rounded-lg text-xs text-left transition-opacity hover:opacity-80"
                    style={{ border: '1px solid var(--accent-gold)', color: 'var(--accent-gold)' }}
                  >
                    {action}
                  </button>
                ))}
              </div>
            </div>
          )
        })()}

        <div ref={bottomRef} />
      </div>
    </div>
  )
}

function StepBubble({ step, isSynthesis }: { step: DebateStep; isSynthesis?: boolean }) {
  return (
    <div className="flex gap-3 justify-start">
      <div
        className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold text-white shrink-0 mt-1"
        style={{ backgroundColor: step.meta.color }}
      >
        {step.meta.initial}
      </div>
      <div className="max-w-[80%]">
        <span className="text-xs font-medium mb-1 block" style={{ color: step.meta.color }}>
          {step.meta.mentorName}
          {isSynthesis && ' — 綜合觀點'}
        </span>
        <div
          className={`px-4 py-3 rounded-2xl rounded-tl-sm text-sm leading-relaxed whitespace-pre-wrap ${
            step.error ? 'opacity-50 italic' : ''
          }`}
          style={{ backgroundColor: 'var(--bg-bubble-mentor)', color: 'var(--text-primary)' }}
        >
          {step.content}
          {!step.done && !step.error && (
            <span className="inline-flex gap-0.5 ml-1.5 align-middle">
              <span className="typing-dot w-1 h-1 rounded-full bg-current inline-block" />
              <span className="typing-dot w-1 h-1 rounded-full bg-current inline-block" />
              <span className="typing-dot w-1 h-1 rounded-full bg-current inline-block" />
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

function ThinkingIndicator({ name, color }: { name: string; color: string }) {
  return (
    <div className="flex gap-3 justify-start">
      <div
        className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold text-white shrink-0 mt-1"
        style={{ backgroundColor: color, opacity: 0.6 }}
      >
        ?
      </div>
      <div
        className="px-4 py-3 rounded-2xl rounded-tl-sm text-sm"
        style={{ backgroundColor: 'var(--bg-bubble-mentor)', color: 'var(--text-muted)' }}
      >
        {name}正在聆聽
        <span className="inline-flex gap-1 ml-2">
          <span className="typing-dot w-1.5 h-1.5 rounded-full inline-block" style={{ backgroundColor: color }} />
          <span className="typing-dot w-1.5 h-1.5 rounded-full inline-block" style={{ backgroundColor: color }} />
          <span className="typing-dot w-1.5 h-1.5 rounded-full inline-block" style={{ backgroundColor: color }} />
        </span>
      </div>
    </div>
  )
}
