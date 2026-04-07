import { auth } from '@clerk/nextjs/server'
import { streamText } from 'ai'
import { proxy } from '@/lib/ai-proxy'
import { PERSONAS } from '@/lib/personas'
import { getCustomPersonas, getTheories } from '@/lib/supabase/admin'
import { getUserMemories, saveMemories } from '@/lib/supabase/client'
import { extractMemories } from '@/lib/memory-extraction'
import type { Persona } from '@/lib/types/persona'
import type { MemoryRecord } from '@/lib/types/memory'

export const maxDuration = 60

// 速率限制：辯論比較貴，每分鐘 5 次
const RATE_LIMIT = 5
const WINDOW_MS = 60_000
const rateLimitMap = new Map<string, number[]>()

function checkRateLimit(userId: string): boolean {
  const now = Date.now()
  const windowStart = now - WINDOW_MS
  const timestamps = (rateLimitMap.get(userId) ?? []).filter((t) => t > windowStart)
  if (timestamps.length >= RATE_LIMIT) return false
  timestamps.push(now)
  rateLimitMap.set(userId, timestamps)
  return true
}

function buildMemoryContext(memories: MemoryRecord[]): string {
  if (memories.length === 0) return ''
  const lines = memories.map((m) => {
    const c = m.content as Record<string, string>
    switch (m.type) {
      case 'topic': return `- 曾討論過：${c.topic}（${c.detail}）`
      case 'decision': return `- 曾決定：${c.decision}（狀態：${c.outcome}）`
      case 'preference':
        return c.dislike
          ? `- 不喜歡：${c.dislike}（原因：${c.reason}）`
          : `- 喜歡：${c.like}（原因：${c.reason}）`
      case 'milestone': return `- 里程碑：${c.description}`
      default: return ''
    }
  }).filter(Boolean)
  return `\n\n【你對這位用戶的了解】\n${lines.join('\n')}\n`
}

interface StepMeta {
  mentorId: string
  mentorName: string
  color: string
  initial: string
}

export async function POST(req: Request) {
  const { userId } = await auth()
  if (!userId) return new Response('Unauthorized', { status: 401 })
  if (!checkRateLimit(userId)) return new Response('Too Many Requests', { status: 429 })

  const { question, mentorIds }: { question: string; mentorIds: string[] } = await req.json()

  if (!question?.trim() || !mentorIds || mentorIds.length < 2) {
    return new Response('需要問題和至少 2 位導師', { status: 400 })
  }

  // 載入導師資料
  const customPersonas = await getCustomPersonas()
  const mentors: Persona[] = []
  for (const id of mentorIds) {
    const p = PERSONAS[id] ?? customPersonas.find((pp) => pp.id === id)
    if (p) mentors.push(p)
  }
  if (mentors.length < 2) {
    return new Response('找不到足夠的導師', { status: 400 })
  }

  // 載入用戶記憶 + 理論
  const [memories, theories] = await Promise.all([
    getUserMemories(userId),
    getTheories(),
  ])
  const memoryContext = buildMemoryContext(memories)
  const theoryContext = theories.length > 0
    ? `\n\n【可參考的理論框架】\n${theories.map((t) => `- ${t.name}：${t.coreIdea}\n  應用：${t.systemPromptExtension}`).join('\n')}\n\n在回應中，如果相關，自然地融入以上理論框架來支持你的觀點。`
    : ''

  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      const previousViews: string[] = []
      const allTexts: string[] = []

      // 串流輔助：送出一個導師的逐字回應
      async function streamMentorStep(
        meta: StepMeta,
        systemPrompt: string,
        prompt: string,
        type: 'step' | 'synthesis',
      ): Promise<string> {
        // 先送 step_start，前端開始顯示泡泡
        controller.enqueue(encoder.encode(
          `data: ${JSON.stringify({ type: `${type}_start`, meta })}\n\n`
        ))

        const result = streamText({
          model: proxy('claude-sonnet-4-6'),
          system: systemPrompt,
          prompt,
          maxOutputTokens: type === 'synthesis' ? 500 : 400,
        })

        let fullText = ''
        for await (const chunk of result.textStream) {
          fullText += chunk
          controller.enqueue(encoder.encode(
            `data: ${JSON.stringify({ type: `${type}_delta`, mentorId: meta.mentorId, delta: chunk })}\n\n`
          ))
        }

        // 送 step_done
        controller.enqueue(encoder.encode(
          `data: ${JSON.stringify({ type: `${type}_done`, mentorId: meta.mentorId })}\n\n`
        ))

        return fullText
      }

      // Step 1~N：每個導師依序回應
      for (let i = 0; i < mentors.length; i++) {
        const mentor = mentors[i]
        const prevContext = previousViews.length > 0
          ? `\n\n【前面導師的觀點】\n${previousViews.join('\n\n')}\n\n請回應前面導師的觀點（可以同意、反駁或補充），然後給出你自己的看法。`
          : ''

        const meta: StepMeta = {
          mentorId: mentor.id,
          mentorName: mentor.name,
          color: mentor.color,
          initial: mentor.initial,
        }

        try {
          const text = await streamMentorStep(
            meta,
            mentor.systemPrompt + memoryContext + theoryContext + prevContext,
            `用戶的問題：${question}\n\n請以你（${mentor.name}）的角度回應。保持在 150-250 字之間。`,
            'step',
          )
          previousViews.push(`${mentor.name}：${text}`)
          allTexts.push(text)

        } catch (err) {
          console.error(`[Debate] ${mentor.name} 回應失敗:`, err)
          controller.enqueue(encoder.encode(
            `data: ${JSON.stringify({ type: 'step_error', meta, error: `${mentor.name}暫時無法回應` })}\n\n`
          ))
        }
      }

      // 最後一步：主持人整合
      if (previousViews.length > 0) {
        const allViews = previousViews.join('\n\n')
        const synthMeta: StepMeta = {
          mentorId: '_synthesizer',
          mentorName: '主持人',
          color: '#d97706',
          initial: 'S',
        }

        try {
          const synthText = await streamMentorStep(
            synthMeta,
            `你是圓桌討論的主持人。你的角色是綜合各位導師的觀點，找出共識與分歧，給出一個均衡的建議。
用繁體中文回應，保持在 200-300 字。不要偏袒任何一位導師。

在回應最後，用以下格式列出 1-3 個具體可行動建議（每行一個）：
【行動】建議內容
${memoryContext}`,
            `用戶的問題：${question}\n\n各位導師的觀點：\n${allViews}\n\n請綜合以上觀點，給出你的建議。`,
            'synthesis',
          )
          allTexts.push(synthText)

        } catch (err) {
          console.error('[Debate] 整合失敗:', err)
          controller.enqueue(encoder.encode(
            `data: ${JSON.stringify({ type: 'synthesis_error' })}\n\n`
          ))
        }
      }

      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'done' })}\n\n`))
      controller.close()

      // 非同步提取記憶
      const combinedText = allTexts.join('\n')
      extractMemories(question, combinedText).then((extracted) => {
        if (extracted.length > 0) saveMemories(userId, extracted)
      })
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  })
}
