import { auth } from '@clerk/nextjs/server'
import { streamText, convertToModelMessages, type UIMessage } from 'ai'
import { anthropic } from '@ai-sdk/anthropic'
import { PERSONAS } from '@/lib/personas'
import { getUserMemories, saveMemories } from '@/lib/supabase/client'
import { extractMemories } from '@/lib/memory-extraction'
import type { MemoryRecord } from '@/lib/types/memory'

export const maxDuration = 30

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

  const { messages, mentor: mentorId }: { messages: UIMessage[]; mentor: string } = await req.json()

  const persona = PERSONAS[mentorId]
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
    model: anthropic('claude-sonnet-4-6'),
    system: systemPrompt,
    messages: await convertToModelMessages(messages),
    maxOutputTokens: 600,
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
