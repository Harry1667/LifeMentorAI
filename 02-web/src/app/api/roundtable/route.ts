import { auth } from '@clerk/nextjs/server'
import { streamText } from 'ai'
import { proxy } from '@/lib/ai-proxy'
import { PERSONAS } from '@/lib/personas'
import { getCustomPersonas, getTheories } from '@/lib/supabase/admin'
import { getUserMemories } from '@/lib/supabase/client'
import type { Persona } from '@/lib/types/persona'
import type { MemoryRecord } from '@/lib/types/memory'

export const maxDuration = 60

// 速率限制
const RATE_LIMIT = 15
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

export interface RoundtableMessage {
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

interface RequestBody {
  messages: RoundtableMessage[]
  mentorIds: string[]
  replyToMentorId?: string      // 回覆特定導師
  mentionedMentorIds?: string[] // @提及的導師
  synthesize?: boolean          // 請主持人總結
}

export async function POST(req: Request) {
  const { userId } = await auth()
  if (!userId) return new Response('Unauthorized', { status: 401 })
  if (!checkRateLimit(userId)) return new Response('Too Many Requests', { status: 429 })

  const body: RequestBody = await req.json()
  const { messages, mentorIds, replyToMentorId, mentionedMentorIds, synthesize } = body

  if (!messages || messages.length === 0 || !mentorIds || mentorIds.length < 2) {
    return new Response('需要對話紀錄和至少 2 位導師', { status: 400 })
  }

  // 載入導師
  const customPersonas = await getCustomPersonas()
  const allPersonaMap = new Map<string, Persona>()
  for (const id of mentorIds) {
    const p = PERSONAS[id] ?? customPersonas.find((pp) => pp.id === id)
    if (p) allPersonaMap.set(id, p)
  }

  // 載入記憶 + 理論
  const [memories, theories] = await Promise.all([
    getUserMemories(userId),
    getTheories(),
  ])
  const memoryContext = buildMemoryContext(memories)
  const theoryContext = theories.length > 0
    ? `\n\n【可參考的理論框架】\n${theories.map((t) => `- ${t.name}：${t.coreIdea}\n  應用：${t.systemPromptExtension}`).join('\n')}\n\n如果相關，自然地融入以上理論框架。`
    : ''

  // 把對話歷史格式化成文字
  function formatHistory(msgs: RoundtableMessage[]): string {
    return msgs.map((m) => {
      const replyPrefix = m.replyToId
        ? (() => {
            const target = msgs.find((mm) => mm.id === m.replyToId)
            return target ? `（回覆 ${target.mentorName ?? '用戶'}）` : ''
          })()
        : ''
      if (m.role === 'user') return `用戶${replyPrefix}：${m.content}`
      return `${m.mentorName}${replyPrefix}：${m.content}`
    }).join('\n\n')
  }

  const history = formatHistory(messages)

  // 決定哪些導師要回應
  let respondingMentorIds: string[]

  if (synthesize) {
    respondingMentorIds = [] // 只有主持人
  } else if (replyToMentorId) {
    // 回覆特定導師 → 該導師先回，其他導師可補充
    respondingMentorIds = [
      replyToMentorId,
      ...mentorIds.filter((id) => id !== replyToMentorId),
    ]
  } else if (mentionedMentorIds && mentionedMentorIds.length > 0) {
    // @提及 → 被提及的先回，其他可補充
    const mentioned = mentionedMentorIds.filter((id) => allPersonaMap.has(id))
    const rest = mentorIds.filter((id) => !mentioned.includes(id))
    respondingMentorIds = [...mentioned, ...rest]
  } else {
    // 預設全部回應
    respondingMentorIds = [...mentorIds]
  }

  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      // 導師回應
      const newResponses: string[] = []

      for (let i = 0; i < respondingMentorIds.length; i++) {
        const mentorId = respondingMentorIds[i]
        const mentor = allPersonaMap.get(mentorId)
        if (!mentor) continue

        const isPrimary = i === 0 // 第一位是主要回應者
        const othersAlreadySaid = newResponses.length > 0
          ? `\n\n【本輪其他導師已說】\n${newResponses.join('\n\n')}`
          : ''

        // 非主要回應者：可以選擇不回應
        const skipInstruction = !isPrimary
          ? `\n\n如果你覺得前面的導師已經充分回應了，而你沒有不同觀點要補充，只需回覆「（點頭）」即可。不要為了說話而說話。`
          : ''

        const mentionInstruction = mentionedMentorIds?.includes(mentorId)
          ? '\n\n用戶特別點名了你，請務必回應。'
          : ''

        const replyInstruction = replyToMentorId === mentorId
          ? '\n\n用戶正在回覆你之前說的話，請直接延續那個話題回應。'
          : ''

        const systemPrompt = mentor.systemPrompt + memoryContext + theoryContext +
          `\n\n你正在一個圓桌群聊中，與其他導師和用戶一起討論。像群組聊天一樣自然對話。
適時向用戶提出反問，幫助他們深入思考。保持 100-200 字。` +
          skipInstruction + mentionInstruction + replyInstruction

        const prompt = `對話紀錄：\n${history}${othersAlreadySaid}\n\n請以 ${mentor.name} 的角度回應。`

        const meta = {
          mentorId: mentor.id,
          mentorName: mentor.name,
          color: mentor.color,
          initial: mentor.initial,
        }

        try {
          controller.enqueue(encoder.encode(
            `data: ${JSON.stringify({ type: 'step_start', meta })}\n\n`
          ))

          const result = streamText({
            model: proxy('claude-sonnet-4-6'),
            system: systemPrompt,
            prompt,
            maxOutputTokens: 400,
          })

          let fullText = ''
          for await (const chunk of result.textStream) {
            fullText += chunk
            controller.enqueue(encoder.encode(
              `data: ${JSON.stringify({ type: 'step_delta', mentorId: mentor.id, delta: chunk })}\n\n`
            ))
          }

          controller.enqueue(encoder.encode(
            `data: ${JSON.stringify({ type: 'step_done', mentorId: mentor.id })}\n\n`
          ))

          // 如果導師選擇跳過，不加到記錄
          if (fullText.trim() !== '（點頭）') {
            newResponses.push(`${mentor.name}：${fullText}`)
          } else {
            // 送一個 skip 事件讓前端知道
            controller.enqueue(encoder.encode(
              `data: ${JSON.stringify({ type: 'step_skip', mentorId: mentor.id })}\n\n`
            ))
          }
        } catch (err) {
          console.error(`[Roundtable] ${mentor.name} 回應失敗:`, err)
          controller.enqueue(encoder.encode(
            `data: ${JSON.stringify({ type: 'step_error', meta, error: `${mentor.name}暫時無法回應` })}\n\n`
          ))
        }
      }

      // 主持人總結（只在 synthesize=true 時）
      if (synthesize) {
        const synthMeta = {
          mentorId: '_synthesizer',
          mentorName: '主持人',
          color: '#d97706',
          initial: 'S',
        }

        try {
          controller.enqueue(encoder.encode(
            `data: ${JSON.stringify({ type: 'synthesis_start', meta: synthMeta })}\n\n`
          ))

          const result = streamText({
            model: proxy('claude-sonnet-4-6'),
            system: `你是圓桌討論的主持人。綜合所有導師和用戶的對話，找出共識與分歧，給出均衡的建議。
用繁體中文回應，200-300 字。不偏袒任何導師。

在回應最後，用以下格式列出 1-3 個具體可行動建議（每行一個）：
【行動】建議內容
${memoryContext}`,
            prompt: `完整對話紀錄：\n${history}\n\n請綜合以上討論，給出你的總結和建議。`,
            maxOutputTokens: 500,
          })

          for await (const chunk of result.textStream) {
            controller.enqueue(encoder.encode(
              `data: ${JSON.stringify({ type: 'synthesis_delta', mentorId: '_synthesizer', delta: chunk })}\n\n`
            ))
          }

          controller.enqueue(encoder.encode(
            `data: ${JSON.stringify({ type: 'synthesis_done', mentorId: '_synthesizer' })}\n\n`
          ))
        } catch (err) {
          console.error('[Roundtable] 主持人總結失敗:', err)
          controller.enqueue(encoder.encode(
            `data: ${JSON.stringify({ type: 'synthesis_error' })}\n\n`
          ))
        }
      }

      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'done' })}\n\n`))
      controller.close()
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
