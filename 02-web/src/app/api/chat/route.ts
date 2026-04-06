import { auth } from '@clerk/nextjs/server'
import { streamText, convertToModelMessages, type UIMessage } from 'ai'
import { proxy } from '@/lib/ai-proxy'
import { PERSONAS } from '@/lib/personas'
import { getUserMemories, saveMemories } from '@/lib/supabase/client'
import { getCustomPersonas } from '@/lib/supabase/admin'
import { extractMemories } from '@/lib/memory-extraction'
import type { MemoryRecord } from '@/lib/types/memory'
import type { Persona } from '@/lib/types/persona'

export const maxDuration = 30

// 速率限制：每個 userId 每分鐘最多 20 次請求
const RATE_LIMIT = 20
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
      case 'topic':
        return `- 曾討論過：${c.topic}（${c.detail}）`
      case 'decision':
        return `- 曾決定：${c.decision}（狀態：${c.outcome}）`
      case 'preference':
        return c.dislike
          ? `- 不喜歡：${c.dislike}（原因：${c.reason}）`
          : `- 喜歡：${c.like}（原因：${c.reason}）`
      case 'milestone':
        return `- 里程碑：${c.description}`
      default:
        return ''
    }
  }).filter(Boolean)

  return `\n\n【你對這位用戶的了解】\n${lines.join('\n')}\n\n請在回應中自然地融入這些背景，讓用戶感受到你記得他們。`
}

export async function POST(req: Request) {
  // 只從 Clerk auth() 取 userId，不信任 body
  const { userId } = await auth()
  if (!userId) {
    return new Response('Unauthorized', { status: 401 })
  }

  if (!checkRateLimit(userId)) {
    return new Response('Too Many Requests', { status: 429 })
  }

  const { messages, mentor: mentorId }: { messages: UIMessage[]; mentor: string } = await req.json()

  // 先查 hardcoded，再查 DB 自訂導師
  let persona: Persona | undefined = PERSONAS[mentorId]
  if (!persona) {
    const custom = await getCustomPersonas()
    persona = custom.find((p) => p.id === mentorId)
  }
  if (!persona) {
    return new Response('Invalid mentor', { status: 400 })
  }

  // 讀取記憶（LIMIT 20，按 importance DESC）
  const memories = await getUserMemories(userId)
  const memoryContext = buildMemoryContext(memories)

  const systemPrompt = persona.systemPrompt + memoryContext

  // 取最後一條用戶訊息，用於記憶提取
  const lastUserMessage = [...messages].reverse().find((m) => m.role === 'user')?.parts
    .filter((p): p is { type: 'text'; text: string } => p.type === 'text')
    .map((p) => p.text)
    .join('') ?? ''

  // 串流回應
  const result = streamText({
    model: proxy('claude-sonnet-4-6'),
    system: systemPrompt,
    messages: await convertToModelMessages(messages),
    maxTokens: 600,
    onFinish: async ({ text }) => {
      // 非同步提取記憶，不阻塞回應
      extractMemories(lastUserMessage, text).then((extracted) => {
        if (extracted.length > 0) {
          saveMemories(userId, extracted)
        }
      })
    },
  })

  return result.toUIMessageStreamResponse()
}
