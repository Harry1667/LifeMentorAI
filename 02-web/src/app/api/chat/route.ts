import { auth } from '@clerk/nextjs/server'
import { streamText, convertToModelMessages, type UIMessage } from 'ai'
import { proxy } from '@/lib/ai-proxy'
import { PERSONAS } from '@/lib/personas'
import { getUserMemories, saveMemories } from '@/lib/supabase/client'
import { getCustomPersonas, getTheories, getRecentContext } from '@/lib/supabase/admin'
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

  // 讀取記憶 + 理論
  const [memories, theories] = await Promise.all([
    getUserMemories(userId),
    getTheories(),
  ])
  const memoryContext = buildMemoryContext(memories)
  const theoryContext = theories.length > 0
    ? `\n\n【已加入的思維工具箱】\n${theories.map((t) => `- ${t.name}：${t.coreIdea}\n  如何應用：${t.systemPromptExtension}`).join('\n')}\n\n你可以主動使用這些理論來分析問題。嘗試將理論和你自己的核心思維融合，產生更深刻的見解。`
    : ''

  const actionInstruction = '\n\n如果你在回應中給了具體可執行的建議，在回應最後另起一行用這個格式標記（最多 1 個）：\n【行動】具體的行動建議內容\n不是每次都需要標記，只有當建議夠具體、可立刻執行時才加。'

  // 第一條訊息時，查近期對話和未完成行動，讓導師自然回顧
  const userMsgCount = messages.filter((m) => m.role === 'user').length
  const recentContext = userMsgCount <= 1 ? await getRecentContext(userId) : ''

  const systemPrompt = persona.systemPrompt + memoryContext + theoryContext + recentContext + actionInstruction

  // 取最後一條用戶訊息，用於記憶提取
  const lastUserMsg = [...messages].reverse().find((m) => m.role === 'user')
  const lastUserMessage = lastUserMsg?.parts
    ?.filter((p): p is { type: 'text'; text: string } => p.type === 'text')
    .map((p) => p.text)
    .join('') ?? ''

  // 串流回應
  const result = streamText({
    model: proxy('claude-sonnet-4-6'),
    system: systemPrompt,
    messages: await convertToModelMessages(messages),
    maxOutputTokens: 1200,
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
